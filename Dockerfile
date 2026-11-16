# Breathprint on any container host (Cloud Run, Fly, a VPS): the same API and app as on Vercel.
FROM oven/bun:1.4-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun x vite build

FROM oven/bun:1.4-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist
USER bun
EXPOSE 8080
CMD ["bun", "run", "server/serve.ts"]
