WATCH THIS TO KNOW WHY WE SHOULD WIN : 
https://drive.google.com/file/d/12AYQyTab_ofnYW6Deer0p7FS2G3VkK2V/view?usp=drive_link

### One‑click deploy

[Deploy to Render](https://render.com/deploy?repo=https://github.com/ishaan-arora-1/test)

[Deploy on Railway](https://railway.app/template/new?template=https://github.com/ishaan-arora-1/test)

Note: The default `WEBHOOK_URL` ends with `/sse` and may 404 to POST. If your Make scenario expects POST, replace it with a Make "Custom webhook" URL. If you need an SSE/MCP client instead, let me know and I’ll adapt the code.

### SSE client mode (Make Agentic AI /sse)
This service now connects as an SSE client to your Make Agentic AI `/sse` endpoint and logs incoming events.

Env vars:
- `WEBHOOK_URL` (required): Your `/sse` URL
- `MCP_BEARER` (optional): If your endpoint requires Authorization header
- `PORT` (optional): Defaults to 8080
- `RECONNECT_BASE_MS` (optional): Initial backoff, default 500ms
- `RECONNECT_MAX_MS` (optional): Max backoff, default 30000ms

Endpoints:
- `GET /health` — reports connection status and last event info

Run locally:
```bash
npm install
WEBHOOK_URL="https://us2.make.com/mcp/api/v1/u/56d64573-7d20-43f9-b0ce-3081631312e3/sse" \
PORT=8080 \
node index.js
```

Deploy using the buttons below and set `WEBHOOK_URL` to your `/sse` endpoint.