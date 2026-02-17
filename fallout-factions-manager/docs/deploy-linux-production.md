# Production deployment on Linux (port 80 + HTTPS with Certbot)

This setup runs:
- app + postgres in Docker (`docker-compose.prod.yml`)
- public traffic on host `nginx` (port `80` / `443`)
- TLS certificates from Certbot.

## 1. Requirements

- Linux server with public IP
- domain pointed to this server (A/AAAA record)
- open firewall ports: `80`, `443`
- Docker + Docker Compose plugin
- Nginx + Certbot + Certbot nginx plugin

Example install (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker nginx
```

If you use UFW:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## 2. Prepare environment

In project root:

```bash
cp .env.production.template .env.production
```

Edit `.env.production`:

- set your real domain in `NEXTAUTH_URL` (recommended `https://...`)
- set strong secrets and passwords.

Generate strong secrets quickly:

```bash
openssl rand -base64 48
```

Use a different value for:
- `NEXTAUTH_SECRET`
- `AUTH_ACCESS_SECRET`
- `AUTH_REFRESH_SECRET`

## 3. Start production containers

Build and start:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Check:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f web
```

## 4. Run seed once (first deployment only)

After first startup, seed base data once:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec web npm run seed:prod
```

Do **not** run seed on every restart.

## 5. Configure Nginx on host (port 80)

Copy config:

```bash
sudo cp deploy/nginx/fallout-factions-manager.conf /etc/nginx/sites-available/fallout-factions-manager.conf
```

Edit file and replace:
- `your-domain.example`
- `www.your-domain.example`

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/fallout-factions-manager.conf /etc/nginx/sites-enabled/fallout-factions-manager.conf
sudo nginx -t
sudo systemctl reload nginx
```

Now app is reachable from outside on port `80`.

## 6. Enable HTTPS with Certbot (domain)

Issue cert and auto-configure redirect:

```bash
sudo certbot --nginx \
  -d your-domain.example \
  -d www.your-domain.example \
  -m you@example.com \
  --agree-tos \
  --no-eff-email \
  --redirect
```

Verify renewal:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

## 7. HTTPS without domain (by public IP)

If you do not have a domain yet, use one of these options:

### Option A (trusted): Let's Encrypt certificate for IP

Let's Encrypt supports IP certificates, but only with the `shortlived` profile.

Important:
- your ACME client must support requesting IP certs + profile selection
- if your local `certbot` version does not support it yet, use `lego`/`acme.sh` or temporary Option B below.

Prepare:

```bash
sudo apt install -y lego
sudo mkdir -p /var/www/letsencrypt
PUBLIC_IP="203.0.113.10"
```

Use nginx config template for IP HTTPS:

```bash
sudo cp deploy/nginx/fallout-factions-manager-ip-https.conf /etc/nginx/sites-available/fallout-factions-manager-ip.conf
```

Edit this file and replace all `YOUR_PUBLIC_IP` with your real IP.

Enable config:

```bash
sudo ln -s /etc/nginx/sites-available/fallout-factions-manager-ip.conf /etc/nginx/sites-enabled/fallout-factions-manager-ip.conf
sudo nginx -t
sudo systemctl reload nginx
```

Issue cert for IP (HTTP-01 challenge):

```bash
sudo lego \
  --email you@example.com \
  --accept-tos \
  --server https://acme-v02.api.letsencrypt.org/directory \
  --profile shortlived \
  --domains "64.226.81.96" \
  --http \
  --http.webroot /var/www/letsencrypt \
  --path /etc/lego \
  run
```

Certificate paths in nginx config:
- `/etc/lego/certificates/YOUR_PUBLIC_IP.crt`
- `/etc/lego/certificates/YOUR_PUBLIC_IP.key`

Reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Renewal (run daily via cron/systemd timer):

```bash
sudo lego \
  --email you@example.com \
  --accept-tos \
  --server https://acme-v02.api.letsencrypt.org/directory \
  --profile shortlived \
  --domains "$PUBLIC_IP" \
  --http \
  --http.webroot /var/www/letsencrypt \
  --path /etc/lego \
  renew --days 2
sudo systemctl reload nginx
```

Set in `.env.production`:

```env
NEXTAUTH_URL=https://YOUR_PUBLIC_IP
AUTH_COOKIE_SECURE=true
```

### Option B (quick fallback): self-signed certificate on IP

This gives HTTPS encryption, but browser will show warning until you trust the certificate manually.

```bash
PUBLIC_IP="203.0.113.10"
sudo openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout /etc/ssl/private/fallout-ip.key \
  -out /etc/ssl/certs/fallout-ip.crt \
  -subj "/CN=${PUBLIC_IP}" \
  -addext "subjectAltName=IP:${PUBLIC_IP}"
```

Then in nginx IP config, replace cert paths with:
- `/etc/ssl/certs/fallout-ip.crt`
- `/etc/ssl/private/fallout-ip.key`

For this fallback, keep:

```env
NEXTAUTH_URL=https://YOUR_PUBLIC_IP
AUTH_COOKIE_SECURE=true
```

## 8. Important auth note (cookies over HTTP/HTTPS)

By default in production:
- `AUTH_COOKIE_SECURE=true`
- auth cookies are `Secure` (recommended).

If you want temporary HTTP-only login on port 80 (not recommended), set:

```env
AUTH_COOKIE_SECURE=false
NEXTAUTH_URL=http://your-domain.example
```

Then restart app container:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

For real production, keep `AUTH_COOKIE_SECURE=true` and use HTTPS.

## 9. Updates

When updating app:

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## 10. Useful operations

Restart stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart
```

Stop stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

Tail logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f web
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f db
```

## 11. Troubleshooting

### Warning: `PG_ROOT_PASSWORD variable is not set`

Use `--env-file .env.production` with every compose command, for example:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Alternative: export variables once in your shell:

```bash
set -a
source .env.production
set +a
```

### `failed to execute bake: signal: killed` during build

Most often this means the kernel killed the build process due to low RAM.

Check OOM events:

```bash
dmesg -T | egrep -i "killed process|out of memory|oom"
free -h
```

Add swap (example 2G):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Then retry build:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### Prisma `SyntaxError` in `@prisma/get-platform` during Docker build

If you see an error like:
- `SyntaxError: Invalid or unexpected token`
- stack trace in `node_modules/@prisma/get-platform/...`

use these checks:

1. Ensure build is run with correct env file:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

2. Ensure Docker context does **not** include local `node_modules` (project has `.dockerignore` for that).

3. Rebuild without stale cache:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build --no-cache web
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

4. This project uses `node:20-alpine` in Dockerfile for better Prisma stability.

### Prisma `P3009` (failed migration in target database)

If you see:
- `Error: P3009`
- `migrate found failed migrations in the target database`

it means one migration was recorded as failed in `_prisma_migrations`.

Typical reason in this project: earlier startup used `prisma db push` and later switched to `prisma migrate deploy`.

Recovery steps:

1. Check if objects from the failed migration already exist:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec db \
  psql -U root_admin -d fallout -c "SELECT typname FROM pg_type WHERE typname='PerkCategory';"

docker compose --env-file .env.production -f docker-compose.prod.yml exec db \
  psql -U root_admin -d fallout -c "SELECT column_name, udt_name FROM information_schema.columns WHERE table_name='Perk' AND column_name='category';"
```

2. If both exist, mark migration as applied:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm web \
  npx prisma migrate resolve --applied 20260212_add_perk_category_automatron
```

3. If one of them is missing, apply SQL manually first, then resolve:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec db \
  psql -U root_admin -d fallout -c "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='PerkCategory') THEN CREATE TYPE \"PerkCategory\" AS ENUM ('REGULAR','AUTOMATRON'); END IF; END $$;"

docker compose --env-file .env.production -f docker-compose.prod.yml exec db \
  psql -U root_admin -d fallout -c "ALTER TABLE \"Perk\" ADD COLUMN IF NOT EXISTS \"category\" \"PerkCategory\" NOT NULL DEFAULT 'REGULAR';"

docker compose --env-file .env.production -f docker-compose.prod.yml run --rm web \
  npx prisma migrate resolve --applied 20260212_add_perk_category_automatron
```

4. Deploy migrations and start:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm web npx prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

If this is a fresh/non-production database with no important data, simplest reset is:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down -v
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```
