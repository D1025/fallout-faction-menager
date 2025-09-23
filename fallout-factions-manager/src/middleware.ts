import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Uwaga: NIE importujemy '@/lib/auth' ani 'next-auth' tutaj.

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Przepuść auth endpointy i assety
    if (
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/icons') ||
        pathname === '/favicon.ico' ||
        pathname === '/manifest.webmanifest'
    ) {
        return NextResponse.next();
    }

    // Odczytaj token z ciasteczka (Edge-safe)
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    // Wymuś logowanie na wszystkim poza /login
    if (!token && pathname !== '/login') {
        const url = new URL('/login', req.url);
        url.searchParams.set('next', pathname);
        return NextResponse.redirect(url);
    }

    // Ochrona panelu admina
    if (pathname.startsWith('/admin') && token?.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/', req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest).*)'],
};
