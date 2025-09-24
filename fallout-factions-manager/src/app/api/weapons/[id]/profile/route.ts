import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

const Input = z.object({ profileIds: z.array(z.string()).default([]) });

async function canWrite(weaponInstanceId: string, userId: string) {
    const w = await prisma.weaponInstance.findUnique({
        where: { id: weaponInstanceId },
        include: { unit: { include: { army: { select: { id: true, ownerId: true } } } } },
    });
    if (!w) return false;
    if (w.unit.army.ownerId === userId) return true;
    const share = await prisma.armyShare.findFirst({
        where: { armyId: w.unit.army.id, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

export async function PATCH(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = Input.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });

    const { profileIds } = parsed.data;

    const w = await prisma.weaponInstance.findUnique({ where: { id }, select: { templateId: true, activeMods: true } });
    if (!w) return new Response('NOT_FOUND', { status: 404 });

    if (!(await canWrite(id, userId))) return new Response('FORBIDDEN', { status: 403 });

    const count = await prisma.weaponProfile.count({ where: { id: { in: profileIds }, weaponId: w.templateId } });
    if (count !== profileIds.length) {
        return new Response(JSON.stringify({ error: 'Profile do not belong to weapon template' }), { status: 400 });
    }

    const filtered = w.activeMods.filter((m) => !m.startsWith('__profile:'));
    const next = [...filtered, ...profileIds.map((pid) => `__profile:${pid}`)];

    const updated = await prisma.weaponInstance.update({
        where: { id },
        data: { activeMods: next },
        select: { id: true, activeMods: true },
    });

    return new Response(JSON.stringify(updated), { status: 200 });
}
