import 'dotenv/config';
import { buildServer } from './server.js';

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? '0.0.0.0';

async function main() {
  const app = await buildServer();
  await app.listen({ port, host });
}

main().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
