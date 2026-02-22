import { getPublicArmySnapshotByToken } from '@/lib/army/publicShare';
import { checkRateLimit, getClientIp, tooManyRequestsResponse } from '@/lib/security/rateLimit';

type AsyncCtx = { params: Promise<{ token: string }> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: AsyncCtx) {
    const ip = getClientIp(_req);
    const limit = checkRateLimit({
        key: `share:read:${ip}`,
        limit: 180,
        windowMs: 60_000,
    });
    if (!limit.ok) return tooManyRequestsResponse(limit.retryAfterSec);

    const { token } = await ctx.params;

    const snapshot = await getPublicArmySnapshotByToken({ token });
    if (!snapshot) return new Response('NOT_FOUND', { status: 404 });

    return new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}
