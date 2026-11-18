# Breathprint on any container host (Cloud Run, Fly, a VPS): the same API and app as on Vercel.
FROM oven/bun:1.4.3-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# The full build, not just Vite: it fills the blog, stamps the offline worker and checks the JS budget.
RUN bun run build

FROM oven/bun:1.4.3-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist
USER bun
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD ["bun", "-e", "const r = await fetch(`http://localhost:${process.env.PORT}/api/health`); process.exit(r.ok ? 0 : 1)"]
CMD ["bun", "run", "server/serve.ts"]
