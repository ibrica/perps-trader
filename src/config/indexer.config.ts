import { registerAs } from '@nestjs/config';

export default registerAs('indexer', () => ({
  host: process.env.INDEXER_HOST,
  wsPort: process.env.INDEXER_WS_PORT,
  apiPort: process.env.INDEXER_API_PORT,
}));
