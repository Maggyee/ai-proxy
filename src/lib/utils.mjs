import crypto from 'node:crypto';

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createNumericCode(length = 6) {
  const max = 10 ** length;
  const raw = crypto.randomInt(0, max);
  return String(raw).padStart(length, '0');
}

export function createId() {
  return crypto.randomUUID();
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function parseAuthToken(headerValue) {
  const value = String(headerValue ?? '').trim();
  if (!value.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return value.slice(7).trim() || null;
}
