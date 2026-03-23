import nodemailer from 'nodemailer';

import { config, requireConfig } from '../config/env.mjs';

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: requireConfig('SMTP_HOST', config.smtpHost),
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: requireConfig('SMTP_USER', config.smtpUser),
        pass: requireConfig('SMTP_PASS', config.smtpPass),
      },
    });
  }

  return transporter;
}

export async function sendVerificationCodeEmail({ email, code }) {
  const client = getTransporter();
  await client.sendMail({
    from: requireConfig('SMTP_FROM', config.smtpFrom),
    to: email,
    subject: 'Nishiki verification code',
    text: `Your Nishiki verification code is ${code}. It expires in ${config.authCodeTtlMinutes} minutes.`,
    html: `<p>Your Nishiki verification code is <strong>${code}</strong>.</p><p>It expires in ${config.authCodeTtlMinutes} minutes.</p>`,
  });
}
