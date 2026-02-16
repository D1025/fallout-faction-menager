import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AuthUser } from '@/lib/authTokens';
import {
    accessTtlSec,
    ACCESS_COOKIE_NAME,
    AUTH_ACCESS_HEADER,
    AUTH_USER_HEADER,
    encodeAuthUserHeader,
    isProduction,
    issueTokenPair,
    refreshTtlSec,
    REFRESH_COOKIE_NAME,
    userFromPayload,
    verifyAccessToken,
    verifyRefreshToken,
} from '@/lib/authTokens';

type AuthResult = {
    user: AuthUser | null;
    refreshedPair: Awaited<ReturnType<typeof issueTokenPair>> | null;
};

const PUBLIC_API_ROUTES = new Set([
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/logout',
]);

function isPublicAsset(pathname: string): boolean {
    return (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/icons') ||
        pathname === '/favicon.ico' ||
        pathname === '/manifest.webmanifest'
    );
}

function isPublicPath(pathname: string): boolean {
    if (isPublicAsset(pathname)) return true;
    if (PUBLIC_API_ROUTES.has(pathname)) return true;
    return false;
}

function setAuthCookies(resp: NextResponse, pair: Awaited<ReturnType<typeof issueTokenPair>>) {
    const secure = isProduction();
    resp.cookies.set(ACCESS_COOKIE_NAME, pair.accessToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: accessTtlSec(),
    });
    resp.cookies.set(REFRESH_COOKIE_NAME, pair.refreshToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: refreshTtlSec(),
    });
}

function clearAuthCookies(resp: NextResponse) {
    const secure = isProduction();
    resp.cookies.set(ACCESS_COOKIE_NAME, '', {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
    resp.cookies.set(REFRESH_COOKIE_NAME, '', {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
}

async function authenticate(req: NextRequest): Promise<AuthResult> {
    const accessToken = req.cookies.get(ACCESS_COOKIE_NAME)?.value ?? null;
    if (accessToken) {
        const accessPayload = await verifyAccessToken(accessToken);
        if (accessPayload) {
            return { user: userFromPayload(accessPayload), refreshedPair: null };
        }
    }

    const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;
    if (!refreshToken) return { user: null, refreshedPair: null };

    const refreshPayload = await verifyRefreshToken(refreshToken);
    if (!refreshPayload) return { user: null, refreshedPair: null };

    const user = userFromPayload(refreshPayload);
    const refreshedPair = await issueTokenPair(user);
    return { user, refreshedPair };
}

function withForwardedAuthHeaders(req: NextRequest, user: AuthUser, accessToken?: string): Headers {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(AUTH_USER_HEADER, encodeAuthUserHeader(user));
    if (accessToken) requestHeaders.set(AUTH_ACCESS_HEADER, accessToken);
    return requestHeaders;
}

function unauthorizedApi(): NextResponse {
    const resp = NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    clearAuthCookies(resp);
    return resp;
}

function forbiddenApi(): NextResponse {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
}

function redirectToLogin(req: NextRequest): NextResponse {
    const loginUrl = new URL('/login', req.url);
    const nextPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    loginUrl.searchParams.set('next', nextPath);
    const resp = NextResponse.redirect(loginUrl);
    clearAuthCookies(resp);
    return resp;
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (pathname === '/login') {
        const authResult = await authenticate(req);
        if (!authResult.user) return NextResponse.next();

        const resp = NextResponse.redirect(new URL('/', req.url));
        if (authResult.refreshedPair) setAuthCookies(resp, authResult.refreshedPair);
        return resp;
    }

    if (pathname.startsWith('/share/') || pathname.startsWith('/api/share/')) {
        const authResult = await authenticate(req);
        if (!authResult.user) return NextResponse.next();

        const requestHeaders = withForwardedAuthHeaders(
            req,
            authResult.user,
            authResult.refreshedPair?.accessToken,
        );
        const resp = NextResponse.next({ request: { headers: requestHeaders } });
        if (authResult.refreshedPair) setAuthCookies(resp, authResult.refreshedPair);
        return resp;
    }

    if (isPublicPath(pathname)) return NextResponse.next();

    const authResult = await authenticate(req);
    if (!authResult.user) {
        if (pathname.startsWith('/api/')) return unauthorizedApi();
        return redirectToLogin(req);
    }

    if (pathname.startsWith('/admin') && authResult.user.role !== 'ADMIN') {
        if (pathname.startsWith('/api/')) return forbiddenApi();
        return NextResponse.redirect(new URL('/', req.url));
    }

    const requestHeaders = withForwardedAuthHeaders(
        req,
        authResult.user,
        authResult.refreshedPair?.accessToken,
    );
    const resp = NextResponse.next({ request: { headers: requestHeaders } });
    if (authResult.refreshedPair) setAuthCookies(resp, authResult.refreshedPair);
    return resp;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest).*)'],
};
