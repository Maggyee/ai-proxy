import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

import { config } from './config/env.mjs';
import { verifyAccessToken } from './lib/auth.mjs';
import { AppError, asAppError } from './lib/errors.mjs';
import { prisma } from './lib/prisma.mjs';
import { parseAuthToken } from './lib/utils.mjs';
import { activeModel, chatWithArticle, hasActiveKey, summarizeArticle } from './modules/ai/service.mjs';
import { authRoutes } from './modules/auth/routes.mjs';
import { registerSocket } from './modules/realtime/hub.mjs';
import { syncRoutes } from './modules/sync/routes.mjs';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.decorate('config', config);
  app.decorateRequest('currentUser', null);
  app.decorate('tryVerifyAccessToken', (token) => {
    try {
      return verifyAccessToken(token);
    } catch {
      return null;
    }
  });
  app.decorate('requireAuth', async (request) => {
    if (!request.currentUser) {
      throw new AppError('Authentication required.', {
        statusCode: 401,
        code: 'authentication_required',
      });
    }
  });

  app.register(cors, {
    origin(origin, callback) {
      if (!origin || config.allowedOrigin === '*') {
        callback(null, true);
        return;
      }
      callback(null, origin === config.allowedOrigin);
    },
    credentials: true,
  });

  app.register(websocket);

  app.addHook('preHandler', async (request) => {
    const token = parseAuthToken(request.headers.authorization);
    if (!token) {
      return;
    }

    const payload = app.tryVerifyAccessToken(token);
    if (!payload?.sub) {
      return;
    }

    request.currentUser = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const appError = asAppError(error);
    request.log.error({ err: error }, appError.message);
    reply.status(appError.statusCode).send({
      ok: false,
      error: {
        message: appError.message,
        code: appError.code,
        details: appError.details,
      },
    });
  });

  app.get('/api/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      provider: config.provider,
      model: activeModel(config),
      hasKey: hasActiveKey(config),
      database: 'ready',
    };
  });

  app.post('/api/ai/summarize', async (request) => summarizeArticle({
    body: request.body ?? {},
    currentUser: request.currentUser,
    config,
  }));

  app.post('/api/ai/chat', async (request) => chatWithArticle({
    body: request.body ?? {},
    currentUser: request.currentUser,
    config,
  }));

  app.get('/ws', { websocket: true }, async (connection, request) => {
    const origin = String(request.headers.origin ?? '').trim();
    if (config.wsAllowedOrigin !== '*' && origin && origin !== config.wsAllowedOrigin) {
      connection.socket.close(1008, 'Origin not allowed');
      return;
    }

    const queryToken = String(request.query?.token ?? '').trim();
    const authToken = parseAuthToken(request.headers.authorization);
    const token = queryToken || authToken;
    if (!token) {
      connection.socket.close(1008, 'Missing token');
      return;
    }

    const payload = app.tryVerifyAccessToken(token);
    if (!payload?.sub) {
      connection.socket.close(1008, 'Invalid token');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
    });
    if (!user) {
      connection.socket.close(1008, 'User not found');
      return;
    }

    registerSocket(user.id, connection.socket);
    connection.socket.send(JSON.stringify({
      event: 'connection.ready',
      payload: {
        userId: user.id,
        connectedAt: new Date().toISOString(),
      },
    }));
  });

  app.register(authRoutes);
  app.register(syncRoutes);

  return app;
}
