import { createApp } from './app.js';
import { env } from './config.js';

const server = createApp().listen(env.PORT, '0.0.0.0', () => {
  console.log(`Service running on ${server.address().port}`);
});
server.on('error', (error) => {
  console.error('Service failed to start:', error.message);
  process.exitCode = 1;
});
function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 30_000).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
