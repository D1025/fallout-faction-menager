# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- run ----------
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl

COPY --from=build /app/.next ./.next
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# prisma + public
COPY prisma ./prisma
COPY public ./public

RUN npx prisma generate

EXPOSE 3000
CMD ["npm","run","start:docker"]
