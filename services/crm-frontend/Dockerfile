# Dockerfile — CRM React frontend (Vite + SPA estático servido con Nginx)
#
# El reverse proxy del lab (infra/nginx) hace proxy_pass http://crm:3000.
# Por eso este nginx interno escucha en :3000 (no en :80) — evita confusión
# con el otro nginx del compose.

# ============================================================
# Stage 1 — build
# ============================================================
FROM node:20-alpine AS build

WORKDIR /app

# Args build-time inyectados por compose. Se leen como env durante `vite build`.
ARG VITE_API_BASE_URL=/api
ARG VITE_SIP_WS_URL=wss://localhost:8089/ws
ARG VITE_SIP_DOMAIN=localhost
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SIP_WS_URL=${VITE_SIP_WS_URL}
ENV VITE_SIP_DOMAIN=${VITE_SIP_DOMAIN}

# Capa de dependencias cacheada — copiamos solo los manifiestos.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Código y build de producción.
COPY tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js components.json eslint.config.js index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# ============================================================
# Stage 2 — runtime
# ============================================================
FROM nginx:1.27-alpine AS runtime

# Healthcheck del propio nginx (lo usa docker compose).
RUN apk add --no-cache curl

COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
