FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@8.15.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV NODE_ENV=production REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium RENDER_HOST=127.0.0.1 RENDER_SERVICE_URL=http://127.0.0.1:3200
EXPOSE 3000
CMD ["node", "scripts/start-production.mjs"]
