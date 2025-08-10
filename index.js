const express = require('express');
const crypto = require('crypto');

// Configuration
const port = Number(process.env.PORT || 8080);
const webhookUrl = process.env.WEBHOOK_URL || 'https://us2.make.com/mcp/api/v1/u/56d64573-7d20-43f9-b0ce-3081631312e3/sse';
const deploymentId = process.env.DEPLOYMENT_ID || crypto.randomUUID();
const publicUrl = process.env.PUBLIC_URL || `http://localhost:${port}`;
const environment = process.env.NODE_ENV || 'production';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', deploymentId });
});

// Optional: forward custom events you POST to this service to the webhook
app.post('/event', async (req, res) => {
  try {
    const payload = {
      event: 'mcp_custom_event',
      deploymentId,
      data: req.body || {},
      timestamp: new Date().toISOString(),
    };
    const result = await postWithRetry(webhookUrl, payload);
    res.status(202).json({ forwarded: true, resultStatus: result.status });
  } catch (error) {
    res.status(500).json({ forwarded: false, error: toErrorMessage(error) });
  }
});

async function postWithRetry(url, body, options = {}) {
  const maxAttempts = options.maxAttempts || 5;
  const baseDelayMs = options.baseDelayMs || 500;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await safeText(response);
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
      }

      return response; // success
    } catch (err) {
      lastError = err;
      const isLast = attempt === maxAttempts;
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`Webhook POST failed (attempt ${attempt}/${maxAttempts}): ${toErrorMessage(err)}${isLast ? '' : ` — retrying in ${delayMs}ms`}`);
      if (isLast) break;
      await delay(delayMs);
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return '<no-body>';
  }
}

function toErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try { return JSON.stringify(error); } catch { return String(error); }
}

async function notifyDeployed() {
  const payload = {
    event: 'mcp_deployed',
    deploymentId,
    publicUrl,
    environment,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await postWithRetry(webhookUrl, payload);
    console.log(`Deployment event sent successfully (status ${response.status})`);
  } catch (error) {
    console.error('Failed to send deployment event:', toErrorMessage(error));
  }
}

app.listen(port, () => {
  console.log(`MCP notifier listening on port ${port}`);
  console.log(`Deployment ID: ${deploymentId}`);
  console.log(`Webhook URL: ${webhookUrl}`);
  notifyDeployed();
}); 