import { verifyRefreshToken, signAccessToken, signRefreshToken, getRefreshExpiryDate } from '../../lib/auth.mjs';
import { AppError } from '../../lib/errors.mjs';
import { sendVerificationCodeEmail } from '../../lib/mailer.mjs';
import { prisma } from '../../lib/prisma.mjs';
import { createId, createNumericCode, normalizeEmail, parseAuthToken, sha256 } from '../../lib/utils.mjs';

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function issueAuthSession(user) {
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken({
    sub: user.id,
    email: user.email,
    tokenId: createId(),
  });

  await prisma.authRefreshToken.create({
    data: {
      id: createId(),
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: getRefreshExpiryDate(),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user),
  };
}

export async function authRoutes(fastify) {
  fastify.post('/api/auth/email/request-code', async (request) => {
    const email = normalizeEmail(request.body?.email);
    if (!email || !email.includes('@')) {
      throw new AppError('A valid email is required.', {
        statusCode: 400,
        code: 'invalid_email',
      });
    }

    const now = new Date();
    const cooldownSince = new Date(now.getTime() - fastify.config.authCodeResendCooldownSeconds * 1000);
    const hourSince = new Date(now.getTime() - 60 * 60 * 1000);

    const [latestCode, hourlyCount] = await Promise.all([
      prisma.authEmailCode.findFirst({
        where: { email },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.authEmailCode.count({
        where: {
          email,
          createdAt: { gte: hourSince },
        },
      }),
    ]);

    if (latestCode && latestCode.createdAt > cooldownSince) {
      throw new AppError('Verification code requested too frequently.', {
        statusCode: 429,
        code: 'verification_code_cooldown',
      });
    }

    if (hourlyCount >= fastify.config.authCodeHourlyLimit) {
      throw new AppError('Verification code hourly limit reached.', {
        statusCode: 429,
        code: 'verification_code_hourly_limit',
      });
    }

    const code = createNumericCode(6);
    const expiresAt = new Date(now.getTime() + fastify.config.authCodeTtlMinutes * 60 * 1000);

    await prisma.authEmailCode.create({
      data: {
        id: createId(),
        email,
        codeHash: sha256(`${email}:${code}`),
        expiresAt,
      },
    });

    await sendVerificationCodeEmail({ email, code });

    return {
      ok: true,
      email,
      expiresAt: expiresAt.toISOString(),
    };
  });

  fastify.post('/api/auth/email/verify-code', async (request) => {
    const email = normalizeEmail(request.body?.email);
    const code = String(request.body?.code ?? '').trim();
    if (!email || !code) {
      throw new AppError('email and code are required.', {
        statusCode: 400,
        code: 'missing_auth_fields',
      });
    }

    const emailCode = await prisma.authEmailCode.findFirst({
      where: {
        email,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!emailCode) {
      throw new AppError('Verification code not found.', {
        statusCode: 400,
        code: 'verification_code_not_found',
      });
    }

    if (emailCode.expiresAt < new Date()) {
      throw new AppError('Verification code expired.', {
        statusCode: 400,
        code: 'verification_code_expired',
      });
    }

    if (emailCode.codeHash !== sha256(`${email}:${code}`)) {
      throw new AppError('Verification code is invalid.', {
        statusCode: 400,
        code: 'verification_code_invalid',
      });
    }

    const user = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.upsert({
        where: { email },
        update: {
          emailVerifiedAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          id: createId(),
          email,
          emailVerifiedAt: new Date(),
        },
      });

      await tx.authEmailCode.update({
        where: { id: emailCode.id },
        data: { consumedAt: new Date() },
      });

      return nextUser;
    });

    return {
      ok: true,
      ...(await issueAuthSession(user)),
    };
  });

  fastify.post('/api/auth/refresh', async (request) => {
    const refreshToken = String(request.body?.refreshToken ?? '').trim();
    if (!refreshToken) {
      throw new AppError('refreshToken is required.', {
        statusCode: 400,
        code: 'missing_refresh_token',
      });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Refresh token is invalid.', {
        statusCode: 401,
        code: 'invalid_refresh_token',
      });
    }

    const userId = String(payload.sub ?? '').trim();
    if (!userId) {
      throw new AppError('Refresh token is invalid.', {
        statusCode: 401,
        code: 'invalid_refresh_token',
      });
    }

    const tokenRow = await prisma.authRefreshToken.findFirst({
      where: {
        userId,
        tokenHash: sha256(refreshToken),
        revokedAt: null,
      },
    });

    if (!tokenRow || tokenRow.expiresAt < new Date()) {
      throw new AppError('Refresh token expired or revoked.', {
        statusCode: 401,
        code: 'expired_refresh_token',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found.', {
        statusCode: 404,
        code: 'user_not_found',
      });
    }

    await prisma.authRefreshToken.update({
      where: { id: tokenRow.id },
      data: { revokedAt: new Date() },
    });

    return {
      ok: true,
      ...(await issueAuthSession(user)),
    };
  });

  fastify.post('/api/auth/logout', async (request) => {
    const authToken = parseAuthToken(request.headers.authorization);
    const accessPayload = authToken ? fastify.tryVerifyAccessToken(authToken) : null;
    const refreshToken = String(request.body?.refreshToken ?? '').trim();

    if (refreshToken) {
      await prisma.authRefreshToken.updateMany({
        where: { tokenHash: sha256(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return {
      ok: true,
      userId: accessPayload?.sub ?? null,
    };
  });

  fastify.get('/api/me', { preHandler: [fastify.requireAuth] }, async (request) => ({
    ok: true,
    user: sanitizeUser(request.currentUser),
  }));
}
