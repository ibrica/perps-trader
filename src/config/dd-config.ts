import { registerAs } from '@nestjs/config';

export default registerAs('dd', () => ({
  apiKey: process.env.DD_API_KEY,
  appKey: process.env.DD_APP_KEY,
  apiUrl: process.env.DD_API_URL,
}));
