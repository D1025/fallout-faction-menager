'use client';

import { useEffect } from 'react';

const AUTH_EXCLUDED_API_PATHS = new Set([
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/logout',
]);

export function Auth401Guard() {
    useEffect(() => {
        const originalFetch = window.fetch.bind(window);

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const res = await originalFetch(input, init);

            if (res.status === 401) {
                try {
                    const rawUrl =
                        typeof input === 'string'
                            ? input
                            : input instanceof URL
                                ? input.toString()
                                : input.url;
                    const parsed = new URL(rawUrl, window.location.origin);
                    const path = parsed.pathname;
                    const isApi = path.startsWith('/api/');
                    const isExcluded = AUTH_EXCLUDED_API_PATHS.has(path) || path.startsWith('/api/share/');
                    const onPublicShare = window.location.pathname.startsWith('/share/');

                    if (isApi && !isExcluded && !onPublicShare && window.location.pathname !== '/login') {
                        const nextPath = `${window.location.pathname}${window.location.search}`;
                        window.location.assign(`/login?next=${encodeURIComponent(nextPath)}`);
                    }
                } catch {
                    // no-op
                }
            }

            return res;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    return null;
}

