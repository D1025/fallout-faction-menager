import { cookies } from 'next/headers';
import {
    ACCESS_COOKIE_NAME,
    accessTtlSec,
    isProduction,
    issueTokenPair,
    REFRESH_COOKIE_NAME,
    refreshTtlSec,
    userFromPayload,
    verifyRefreshToken,
} from '@/lib/authTokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clearAuthCookies(store: Awaited<ReturnType<typeof cookies>>) {
    const secure = isProduction();
    store.set(ACCESS_COOKIE_NAME, '', {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
    store.set(REFRESH_COOKIE_NAME, '', {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
}

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

export async function POST() {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value ?? null;
    if (!refreshToken) {
        clearAuthCookies(cookieStore);
        return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 });
    }

    const refreshPayload = await verifyRefreshToken(refreshToken);
    if (!refreshPayload) {
        clearAuthCookies(cookieStore);
        return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 });
    }

    const user = userFromPayload(refreshPayload);
    const pair = await issueTokenPair(user);
    setAuthCookies(cookieStore, pair);

    return new Response(
        JSON.stringify({
            ok: true,
            user,
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

