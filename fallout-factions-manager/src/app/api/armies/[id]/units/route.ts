import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';
type AsyncCtx = { params: Promise<{ id: string }> };

const CreateUnitSchema = z.object({
    unitTemplateId: z.string().min(1),
    optionId: z.string().min(1), // UnitWeaponOption.id (dla wybranego UnitTemplate)
});

async function userHasWriteAccess(armyId: string, userId: string): Promise<boolean> {
    const army = await prisma.army.findUnique({ where: { id: armyId }, select: { ownerId: true } });
    if (!army) return false;
    if (army.ownerId === userId) return true;

    const share = await prisma.armyShare.findFirst({
        where: { armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

/**
 * Dodaj jednostkę do armii:
 * - weryfikacja, że optionId należy do wskazanego UnitTemplate (unitTemplateId)
 * - utwórz UnitInstance (selectedOptionId = optionId)
 * - na podstawie option.weapon1Id / option.weapon2Id dodaj 1–2 WeaponInstance
 */

export async function POST(req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;
    const armyId = id;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = CreateUnitSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }), { status: 400 });
    }
    const { unitTemplateId, optionId } = parsed.data;

    const can = await userHasWriteAccess(armyId, userId);
    if (!can) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const option = await prisma.unitWeaponOption.findUnique({
        where: { id: optionId },
        select: { id: true, unitId: true, weapon1Id: true, weapon2Id: true },
    });

    if (!option || option.unitId !== unitTemplateId) {
        return new Response(
            JSON.stringify({ error: 'Option does not belong to the provided unit template' }),
            { status: 400 },
        );
    }

    const weaponIds = [option.weapon1Id, option.weapon2Id].filter(
        (x): x is string => typeof x === 'string' && x.length > 0,
    );
    if (weaponIds.length === 0) {
        return new Response(JSON.stringify({ error: 'Selected option has no weapons' }), { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
        const unit = await tx.unitInstance.create({
            data: {
                armyId,
                unitId: unitTemplateId,
                selectedOptionId: option.id,
                wounds: 0,
                present: true,
                chosenPerkIds: [],
                upgradesCount: 0,
            },
            select: { id: true },
        });

        await tx.weaponInstance.createMany({
            data: weaponIds.map((wid) => ({ unitId: unit.id, templateId: wid, activeMods: [] })),
        });

        return tx.unitInstance.findUnique({
            where: { id: unit.id },
            include: { weapons: true, upgrades: true },
        });
    });

    return new Response(JSON.stringify(created), { status: 201 });
}
