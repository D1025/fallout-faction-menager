# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
ENV npm_config_include=optional
RUN npm ci --include=optional \
  && node -e "const fs=require('fs'); const cp=require('child_process'); const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8')); const arch=process.arch==='arm64'?'arm64':'x64'; const swc='@next/swc-linux-'+arch+'-musl'; const lcPkg='lightningcss-linux-'+arch+'-musl'; const swcVer=lock.packages&&lock.packages['node_modules/next']&&lock.packages['node_modules/next'].optionalDependencies&&lock.packages['node_modules/next'].optionalDependencies[swc]; const lcVer=lock.packages&&lock.packages['node_modules/lightningcss']&&lock.packages['node_modules/lightningcss'].optionalDependencies&&lock.packages['node_modules/lightningcss'].optionalDependencies[lcPkg]; if(!swcVer||!lcVer){ throw new Error('Missing optional dependency metadata for arch '+arch);} cp.execSync('npm install --no-save '+swc+'@'+swcVer+' '+lcPkg+'@'+lcVer,{stdio:'inherit'});"

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- run ----------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl
RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs package*.json ./

# prisma + public
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chown=nextjs:nodejs public ./public

RUN mkdir -p /app/public/uploads/weapons

USER nextjs
RUN npx prisma generate

EXPOSE 3000
CMD ["npm","run","start:docker"]
