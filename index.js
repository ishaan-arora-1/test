const express = require('express');
const EventSource = require('eventsource');

// Configuration
const port = Number(process.env.PORT || 8080);
const sseUrl = process.env.WEBHOOK_URL || 'https://us2.make.com/mcp/api/v1/u/56d64573-7d20-43f9-b0ce-3081631312e3/sse';
const bearerToken = process.env.MCP_BEARER || '';
const environment = process.env.NODE_ENV || 'production';

// Reconnect/backoff settings
const baseDelayMs = Number(process.env.RECONNECT_BASE_MS || 500);
const maxDelayMs = Number(process.env.RECONNECT_MAX_MS || 30_000);

const app = express();
app.use(express.json());

let connectionState = {
  status: 'disconnected',
  lastEventId: undefined,
  lastEventAt: undefined,
  lastError: undefined,
  connectAttempts: 0,
};

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    environment,
    sseUrl,
    connection: connectionState,
  });
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoff(attempt) {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
  const jitter = Math.floor(Math.random() * 0.2 * delay);
  return delay + jitter;
}

async function startSseLoop() {
  while (true) {
    connectionState.connectAttempts += 1;
    const attempt = connectionState.connectAttempts;
    const headers = {};
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
    if (connectionState.lastEventId) headers['Last-Event-ID'] = connectionState.lastEventId;

    console.log(`[SSE] connecting (attempt ${attempt}) → ${sseUrl}`);
    const es = new EventSource(sseUrl, { headers });

    let opened = false;

    const onOpen = () => {
      opened = true;
      connectionState.status = 'connected';
      connectionState.lastError = undefined;
      console.log('[SSE] connected');
    };

    const onError = (err) => {
      connectionState.status = 'disconnected';
      connectionState.lastError = err && err.message ? err.message : String(err);
      console.warn('[SSE] error:', connectionState.lastError);
      es.close();
    };

    const onMessage = (ev) => {
      connectionState.lastEventAt = new Date().toISOString();
      if (ev.lastEventId) connectionState.lastEventId = ev.lastEventId;

      try {
        const data = ev.data ? JSON.parse(ev.data) : null;
        console.log('[SSE] event', {
          type: ev.type || 'message',
          id: ev.lastEventId || null,
          at: connectionState.lastEventAt,
          payloadKeys: data && typeof data === 'object' ? Object.keys(data) : null,
        });
      } catch {
        console.log('[SSE] raw event', {
          type: ev.type || 'message',
          id: ev.lastEventId || null,
          at: connectionState.lastEventAt,
          data: ev.data,
        });
      }
    };

    es.addEventListener('open', onOpen);
    es.addEventListener('error', onError);
    es.addEventListener('message', onMessage);

    // Hold until closed; EventSource in Node keeps running until .close() is called in onError
    // After close, compute backoff and reconnect
    while (es.readyState !== 2) { // 2 = CLOSED
      // Sleep briefly to yield
      // eslint-disable-next-line no-await-in-loop
      await wait(500);
    }

    const delay = computeBackoff(attempt);
    console.log(`[SSE] reconnecting in ${delay}ms`);
    // eslint-disable-next-line no-await-in-loop
    await wait(delay);
  }
}

app.listen(port, () => {
  console.log(`MCP SSE client listening on port ${port}`);
  console.log(`SSE URL: ${sseUrl}`);
  if (bearerToken) console.log('Authorization: Bearer <redacted>');
  startSseLoop().catch((err) => console.error('[SSE] fatal loop error:', err));
}); 