---
name: delivery-runtime-docker
description: Use when creating or fixing a Dockerfile and docker-compose.yml for the delivery pipeline runtime validation.
---

# Delivery Runtime Docker

Use this skill when authoring or repairing runtime files in the workspace root: `Dockerfile` and `docker-compose.yml`.

## Hard rules

1. **No shell operators in `COPY` or `ADD`** — `2>/dev/null`, `|| true`, `&&`, pipes, and redirects are shell syntax.
   Docker treats them as file paths and the build fails. Use `RUN` for conditional logic.
2. **Set `ENV CI=true`** before any `npm install` / `pnpm install` / `yarn install` so package managers do not prompt
   for TTY input and do not return non-zero exit codes.
3. **Bind the application to `0.0.0.0`**, not `localhost`. The container IP is not reachable from outside otherwise.
4. **Copy all config files before install** — include `package.json`, lockfile, `pnpm-workspace.yaml`, `.npmrc`,
   `tsconfig.json`, and any workspace manifests. Missing files cause cache-busted rebuilds or install failures.
5. **Do not use port 3000** — it is reserved for the agentic memory system. Use port 3001, 4000, 5173, 8080, or another
   free port.
6. **Use identifiable Docker names** — the runtime prompt specifies `delivery-run-<runId>` for `image`, `container_name`,
   and the compose project `name`. Use those exact values so builds and containers are easy to find.

## Optional directories

Never use shell fallbacks on `COPY`. For an optional directory, create it first:

```dockerfile
# Wrong
COPY public ./public 2>/dev/null || true

# Right — ensure the directory exists (even as public/.gitkeep), then:
COPY public ./public
```

## Minimal docker-compose.yml template

Replace `<runId>` and `<app-port>` with values from the runtime prompt and README.
Also pass through any required environment variables (API keys, database URIs, etc.) from the host using the `\${VAR}` syntax, so they are available inside the container.

```yaml
name: delivery-run-<runId>

services:
  app:
    build: .
    image: delivery-run-<runId>
    container_name: delivery-run-<runId>
    ports:
      - "<app-port>:<app-port>"
    environment:
      HOST: 0.0.0.0
      PORT: "<app-port>"
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      MONGODB_URI: ${MONGODB_URI}
      MONGODB_DB: ${MONGODB_DB}
    restart: "no"
```

Add any other required environment variables from `.env.example` or the project README. Use `\${VAR}` syntax to pass host environment variables into the container.

Users run the app with:

```bash
docker compose -p delivery-run-<runId> up --build
```

## Minimal Dockerfile template

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
ENV CI=true
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

Adjust the build command, output directory, and port to match the project stack.
