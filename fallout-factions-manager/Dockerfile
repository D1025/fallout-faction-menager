FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dobrze mieć też generowanie w build (np. dla typegenów),
# ale kluczowe będzie to w warstwie RUN poniżej.
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

# app (build) i deps
COPY --from=build /app/.next ./.next
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# prisma + public
COPY prisma ./prisma
COPY public ./public

# ⬇️ KLUCZOWE: wygeneruj klienta we FINALNYM obrazie (musl)
RUN npx prisma generate

EXPOSE 3000
CMD ["npm","run","start:docker"]
