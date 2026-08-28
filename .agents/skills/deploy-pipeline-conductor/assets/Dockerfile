# Referência de Dockerfile multi-stage para a skill deploy-pipeline-conductor.
# Exemplo Node.js/TypeScript — adaptar a base image e comandos de build para outra stack.
# Multi-stage mantém a imagem final pequena (sem devDependencies, sem código-fonte de build).

# ---- Stage 1: build ----
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Usuário não-root — nunca rodar o processo da aplicação como root em produção
RUN useradd --uid 1001 --create-home appuser
USER appuser

COPY --from=build --chown=appuser:appuser /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build --chown=appuser:appuser /app/dist ./dist

EXPOSE 3000

# Endpoint de health check consumido pelo cd.yml (deploy-staging / deploy-production)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/main.js"]
