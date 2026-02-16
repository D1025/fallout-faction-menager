import { cookies } from 'next/headers';
import { createHash, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '@/lib/password';
import { ACCESS_COOKIE_NAME, isProduction, issueTokenPair, accessTtlSec, refreshTtlSec, REFRESH_COOKIE_NAME } from '@/lib/authTokens';
import { normalizePasswordTransportHash } from '@/lib/auth/passwordTransport';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
    name: z.string().trim().min(1, 'Username is required.'),
    passwordHash: z.string().min(1, 'Password hash is required.'),
});

function setAuthCookies(store: Awaited<ReturnType<typeof cookies>>, pair: Awaited<ReturnType<typeof issueTokenPair>>) {
    const secure = isProduction();
    store.set(ACCESS_COOKIE_NAME, pair.accessToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: accessTtlSec(),
    });
    store.set(REFRESH_COOKIE_NAME, pair.refreshToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: refreshTtlSec(),
    });
}

function safeHexEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const aa = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (aa.length !== bb.length) return false;
    return timingSafeEqual(aa, bb);
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Invalid payload.' }), { status: 400 });
    }

    const name = parsed.data.name.trim();
    const passwordHash = normalizePasswordTransportHash(parsed.data.passwordHash);
    if (!passwordHash) {
        return new Response(JSON.stringify({ error: 'Invalid credential payload.' }), { status: 400 });
    }

    const existing = await prisma.user.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true, name: true, role: true, passwordHash: true },
    });

    if (!existing?.passwordHash) {
        return new Response(JSON.stringify({ error: 'Invalid credentials.' }), { status: 401 });
    }

    let valid = await verifyPassword(passwordHash, existing.passwordHash).catch(() => false);
    if (!valid) {
        const adminName = (process.env.ADMIN_USERNAME ?? 'admin').trim().toLowerCase();
        const envAdminPassword = process.env.ADMIN_PASSWORD ?? '';
        const isAdminAccount = existing.role === 'ADMIN' && existing.name.trim().toLowerCase() === adminName;
        if (isAdminAccount && envAdminPassword) {
            const expectedTransportHash = createHash('sha256').update(envAdminPassword, 'utf8').digest('hex');
            if (safeHexEquals(passwordHash, expectedTransportHash)) {
                const nextStoredHash = await hashPassword(passwordHash);
                await prisma.user.update({
                    where: { id: existing.id },
                    data: { passwordHash: nextStoredHash },
                });
                valid = true;
            }
        }
    }
    if (!valid) {
        return new Response(JSON.stringify({ error: 'Invalid credentials.' }), { status: 401 });
    }

    const pair = await issueTokenPair({
        id: existing.id,
        name: existing.name,
        role: existing.role as 'USER' | 'ADMIN',
    });

    const cookieStore = await cookies();
    setAuthCookies(cookieStore, pair);

    return new Response(
        JSON.stringify({
            user: { id: existing.id, name: existing.name, role: existing.role },
            accessExpiresAt: pair.accessExpiresAt,
        }),
        {
            status: 200,
            headers: {
                'content-type': 'application/json; charset=utf-8',
                'cache-control': 'no-store',
            },
        },
    );
}
