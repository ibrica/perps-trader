import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: process.env.APP_PORT ? Number(process.env.APP_PORT) : 7777,
  host: process.env.APP_HOST ?? '0.0.0.0',
  version: process.env.VERSION ?? 'NA',
  mongodbUri: process.env.MONGODB_URI,
  mongodbTestUri: process.env.MONGODB_TEST_URI,
  environment: process.env.ENVIRONMENT,
  coinMarketCapApiKey: process.env.COIN_MARKET_CAP_API_KEY,
  bitQueryApiKey: process.env.BIT_QUERY_API_KEY ?? '',
  shyftApiKey: process.env.SHYFT_API_KEY ?? '',
}));
