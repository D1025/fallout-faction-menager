type RateLimitBucket = {
    count: number;
    resetAt: number;
};

type RateLimitInput = {
    key: string;
    limit: number;
    windowMs: number;
};

type RateLimitResult = {
    ok: boolean;
    remaining: number;
    retryAfterSec: number;
};

const buckets = new Map<string, RateLimitBucket>();
let lastSweepAt = 0;

const SWEEP_INTERVAL_MS = 60_000;
const MAX_BUCKETS = 100_000;

function nowMs(): number {
    return Date.now();
}

function sweepIfNeeded(now: number): void {
    if (now - lastSweepAt < SWEEP_INTERVAL_MS && buckets.size < MAX_BUCKETS) return;
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
    if (buckets.size > MAX_BUCKETS) {
        const overflow = buckets.size - MAX_BUCKETS;
        let removed = 0;
        for (const key of buckets.keys()) {
            buckets.delete(key);
            removed += 1;
            if (removed >= overflow) break;
        }
    }
    lastSweepAt = now;
}

export function getClientIp(req: Request): string {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) {
        const first = xff.split(',')[0]?.trim();
        if (first) return first;
    }

    const realIp = req.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;

    const cfIp = req.headers.get('cf-connecting-ip')?.trim();
    if (cfIp) return cfIp;

    const trueClientIp = req.headers.get('true-client-ip')?.trim();
    if (trueClientIp) return trueClientIp;

    return 'unknown';
}

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
    const now = nowMs();
    sweepIfNeeded(now);

    const existing = buckets.get(input.key);
    if (!existing || existing.resetAt <= now) {
        buckets.set(input.key, {
            count: 1,
            resetAt: now + input.windowMs,
        });
        return {
            ok: true,
            remaining: Math.max(0, input.limit - 1),
            retryAfterSec: Math.ceil(input.windowMs / 1000),
        };
    }

    if (existing.count >= input.limit) {
        return {
            ok: false,
            remaining: 0,
            retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        };
    }

    existing.count += 1;
    buckets.set(input.key, existing);

    return {
        ok: true,
        remaining: Math.max(0, input.limit - existing.count),
        retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
}

export function tooManyRequestsResponse(retryAfterSec: number): Response {
    const retry = Math.max(1, Math.floor(retryAfterSec));
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
        status: 429,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'retry-after': String(retry),
        },
    });
}
