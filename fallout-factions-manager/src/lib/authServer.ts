import { cookies, headers } from 'next/headers';
import {
    ACCESS_COOKIE_NAME,
    AUTH_ACCESS_HEADER,
    AUTH_USER_HEADER,
    decodeAuthUserHeader,
    userFromPayload,
    verifyAccessToken,
} from '@/lib/authTokens';

export type AppSession = {
    user: {
        id: string;
        name: string;
        role: 'USER' | 'ADMIN';
        image?: string | null;
    };
};

/** Use: const session = await auth(); */
export async function auth(): Promise<AppSession | null> {
    const headerStore = await headers();

    const userFromHeader = decodeAuthUserHeader(headerStore.get(AUTH_USER_HEADER));
    if (userFromHeader) {
        return { user: { ...userFromHeader, image: null } };
    }

    const tokenFromHeader = headerStore.get(AUTH_ACCESS_HEADER);
    if (tokenFromHeader) {
        const parsed = await verifyAccessToken(tokenFromHeader);
        if (parsed) {
            return { user: { ...userFromPayload(parsed), image: null } };
        }
    }

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;
    if (!accessToken) return null;

    const payload = await verifyAccessToken(accessToken);
    if (!payload) return null;

    return { user: { ...userFromPayload(payload), image: null } };
}
