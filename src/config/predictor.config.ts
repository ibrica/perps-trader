import { registerAs } from '@nestjs/config';

export default registerAs('predictor', () => ({
  url: process.env.PREDICTOR_URL,
  port: process.env.PREDICTOR_PORT,
}));
