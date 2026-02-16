import { auth } from '@/lib/authServer';
import { getPublicArmySnapshotByToken } from '@/lib/army/publicShare';

type AsyncCtx = { params: Promise<{ token: string }> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: AsyncCtx) {
    const { token } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const snapshot = await getPublicArmySnapshotByToken({ token, viewerUserId: userId });
    if (!snapshot) return new Response('NOT_FOUND', { status: 404 });

    return new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}
