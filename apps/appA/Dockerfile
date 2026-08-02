FROM node:20-alpine AS builder

WORKDIR /app

ENV CI=true

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json tsconfig.json ./

RUN npm ci --legacy-peer-deps

COPY src ./src
COPY public ./public

RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

RUN mkdir -p uploads data

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/index.js"]
