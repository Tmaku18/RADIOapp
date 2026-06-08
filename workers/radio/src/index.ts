import http from 'node:http';
import { flushEmojiAggregates, pingRedis } from './redis.js';

const PORT = Number(process.env.RADIO_WORKER_PORT ?? 3099);
const FLUSH_INTERVAL_MS = Number(process.env.EMOJI_FLUSH_INTERVAL_MS ?? 2000);

async function tick() {
  try {
    await flushEmojiAggregates();
  } catch (err) {
    console.error('[radio-worker] flush error', err);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    const redisOk = await pingRedis();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: redisOk ? 'ok' : 'degraded',
        service: 'radio-worker',
        redis: redisOk,
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[radio-worker] listening on :${PORT}`);
});

setInterval(tick, FLUSH_INTERVAL_MS);
void tick();
