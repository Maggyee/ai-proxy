import jwt from 'jsonwebtoken';

import { config, requireConfig } from '../config/env.mjs';

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function signAccessToken(payload) {
  const secret = requireConfig('JWT_ACCESS_SECRET', config.jwtAccessSecret);
  return jwt.sign(payload, secret, { expiresIn: `${config.jwtAccessTtlMinutes}m` });
}

export function signRefreshToken(payload) {
  const secret = requireConfig('JWT_REFRESH_SECRET', config.jwtRefreshSecret);
  return jwt.sign(payload, secret, { expiresIn: `${config.jwtRefreshTtlDays}d` });
}

export function verifyAccessToken(token) {
  const secret = requireConfig('JWT_ACCESS_SECRET', config.jwtAccessSecret);
  return jwt.verify(token, secret);
}

export function verifyRefreshToken(token) {
  const secret = requireConfig('JWT_REFRESH_SECRET', config.jwtRefreshSecret);
  return jwt.verify(token, secret);
}

export function getRefreshExpiryDate() {
  return daysFromNow(config.jwtRefreshTtlDays);
}
