# ETAPA 1: Base de dependencias
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/
# Instalación con soporte para monorepos y legacy-peer-deps
RUN npm install --legacy-peer-deps

# ETAPA 2: Constructor (Build)
FROM base AS builder
COPY . .
# Construir la Web primero para que el backend la encuentre
RUN cd apps/web && npm run build
# Construir el Backend
RUN cd apps/backend && npm run build

# ETAPA 3: Imagen de Producción (Lean)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Crear usuario de seguridad no-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copiar solo lo necesario para ejecutar
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Directorio de almacenamiento de datos y expedientes
RUN mkdir -p storage/expedientes
RUN chown -R expressjs:nodejs /app

USER expressjs

EXPOSE 3001

# Comando de inicio (ejecutamos el backend directamente con Node)
CMD ["node", "apps/backend/dist/server.js"]
