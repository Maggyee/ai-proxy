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

### 健康检查
- `GET /api/health`

### AI 功能
- `POST /api/ai/summarize` — 文章摘要
- `POST /api/ai/chat` — 文章问答

### 认证
- `POST /api/auth/email/request-code` — 请求邮箱验证码
- `POST /api/auth/email/verify-code` — 验证码登录/注册
- `POST /api/auth/refresh` — 刷新 Token
- `POST /api/auth/logout` — 登出
- `GET /api/me` — 获取当前用户信息（需认证）

### 多端同步
- `GET /api/sync/bootstrap` — 全量拉取用户数据（需认证）
- `GET /api/sync/changes?sinceVersion=N` — 增量拉取变更（需认证）
- `POST /api/sync/push` — 推送本地变更（需认证）
- `POST /api/sync/reconcile` — 双向合并同步（需认证）

### 实时推送
- `WS /ws?token=xxx` — WebSocket 连接（需认证）
