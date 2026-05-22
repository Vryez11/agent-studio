import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerAgentRoutes } from './routes/agents.js';
import { registerRunRoutes } from './routes/runs.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(registerAgentRoutes, { prefix: '/agents' });
  await app.register(registerRunRoutes, { prefix: '/runs' });

  return app;
}
