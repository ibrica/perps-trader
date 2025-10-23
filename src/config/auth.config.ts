import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl:
    process.env.GOOGLE_CALLBACK_URL ||
    'http://localhost:7777/api/auth/google/callback',
  jwtSecret: ((): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    return secret;
  })(),
  jwtExpiresIn: process.env.JWT_EXPIRATION || '7d',
  allowedEmails: process.env.ALLOWED_EMAILS
    ? process.env.ALLOWED_EMAILS.split(',').map((email) => email.trim())
    : [],
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3000',
}));
