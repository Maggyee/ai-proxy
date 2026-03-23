# Nishiki AI Proxy

Server-side AI proxy for the Flutter app. The Flutter client only talks to this proxy and never carries model API keys.

## Environment

Copy `.env.example` and fill in the provider and key:

```bash
cd ai_proxy
cp .env.example .env
```

Core variables:

- `AI_PROVIDER=gemini` or `AI_PROVIDER=openai`
- `AI_ALLOWED_ORIGIN=https://blog.nishiki.icu`
- `GEMINI_API_KEY=...`
- `GEMINI_MODEL=gemini-3-flash-preview`
- `OPENAI_API_KEY=...`
- `OPENAI_MODEL=gpt-5.4-mini`
- `PORT=8787`

## Local Run

```bash
cd ai_proxy
node --env-file=.env server.mjs
```

## Docker Run

```bash
cd ai_proxy
docker compose up -d --build
docker compose logs -f
```

The compose file binds the proxy only to `127.0.0.1:8787`, so it is intended to sit behind Nginx on the same server.

## Nginx Reverse Proxy

Recommended: use a dedicated subdomain such as `ai.blog.nishiki.icu`.

1. Copy [nginx.ai-proxy.conf](/C:/Users/14762/Documents/nishikis_app/ai_proxy/nginx.ai-proxy.conf) to your server Nginx config directory.
2. Change `server_name` to your real domain.
3. Enable HTTPS with your usual Certbot or ACME flow.
4. Reload Nginx.

If you prefer a path-based proxy, use a location like:

```nginx
location /ai-proxy/ {
    proxy_pass http://127.0.0.1:8787/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then build Flutter with:

```bash
flutter build web --dart-define=WP_BASE_URL=https://blog.nishiki.icu --dart-define=AI_PROXY_BASE_URL=https://blog.nishiki.icu/ai-proxy
```

If you use a subdomain, build Flutter with:

```bash
flutter build web --dart-define=WP_BASE_URL=https://blog.nishiki.icu --dart-define=AI_PROXY_BASE_URL=https://ai.blog.nishiki.icu
```

## Routes

- `GET /api/health`
- `POST /api/ai/summarize`
- `POST /api/ai/chat`
