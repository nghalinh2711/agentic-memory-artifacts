FROM node:20-alpine AS builder
WORKDIR /app

ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT=standalone

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json next.config.ts ./

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

RUN mkdir -p /app/data /app/uploads && chown nextjs:nodejs /app/data /app/uploads

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3002

CMD ["node", "server.js"]
