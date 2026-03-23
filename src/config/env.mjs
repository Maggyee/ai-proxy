function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value, fallback = false) {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export const config = {
  nodeEnv: (process.env.NODE_ENV ?? 'development').trim(),
  port: asNumber(process.env.PORT, 8787),
  provider: (process.env.AI_PROVIDER ?? 'gemini').trim().toLowerCase(),
  allowedOrigin: (process.env.AI_ALLOWED_ORIGIN ?? '*').trim(),
  wsAllowedOrigin: (process.env.WS_ALLOWED_ORIGIN ?? process.env.AI_ALLOWED_ORIGIN ?? '*').trim(),
  appBaseUrl: (process.env.APP_BASE_URL ?? 'http://127.0.0.1:8787').trim(),
  geminiApiKey: (process.env.GEMINI_API_KEY ?? '').trim(),
  geminiModel: (process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview').trim(),
  openaiApiKey: (process.env.OPENAI_API_KEY ?? '').trim(),
  openaiModel: (process.env.OPENAI_MODEL ?? 'gpt-5.4-mini').trim(),
  databaseUrl: (process.env.DATABASE_URL ?? '').trim(),
  jwtAccessSecret: (process.env.JWT_ACCESS_SECRET ?? '').trim(),
  jwtRefreshSecret: (process.env.JWT_REFRESH_SECRET ?? '').trim(),
  jwtAccessTtlMinutes: asNumber(process.env.JWT_ACCESS_TTL_MINUTES, 15),
  jwtRefreshTtlDays: asNumber(process.env.JWT_REFRESH_TTL_DAYS, 30),
  authCodeTtlMinutes: asNumber(process.env.AUTH_CODE_TTL_MINUTES, 10),
  authCodeResendCooldownSeconds: asNumber(process.env.AUTH_CODE_RESEND_COOLDOWN_SECONDS, 60),
  authCodeHourlyLimit: asNumber(process.env.AUTH_CODE_HOURLY_LIMIT, 5),
  smtpHost: (process.env.SMTP_HOST ?? '').trim(),
  smtpPort: asNumber(process.env.SMTP_PORT, 587),
  smtpUser: (process.env.SMTP_USER ?? '').trim(),
  smtpPass: (process.env.SMTP_PASS ?? '').trim(),
  smtpFrom: (process.env.SMTP_FROM ?? '').trim(),
  smtpSecure: asBoolean(process.env.SMTP_SECURE, false),
};

export function requireConfig(key, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
