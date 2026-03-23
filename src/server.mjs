import { buildApp } from './app.mjs';

const app = buildApp();

async function start() {
  await app.listen({
    host: '0.0.0.0',
    port: app.config.port,
  });
}

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
