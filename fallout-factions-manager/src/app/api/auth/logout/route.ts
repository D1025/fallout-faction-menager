import { cookies } from 'next/headers';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, shouldUseSecureCookies } from '@/lib/authTokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clearAuthCookies(store: Awaited<ReturnType<typeof cookies>>) {
    const secure = shouldUseSecureCookies();
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

export async function POST() {
    const cookieStore = await cookies();
    clearAuthCookies(cookieStore);
    return new Response(null, { status: 204 });
}

