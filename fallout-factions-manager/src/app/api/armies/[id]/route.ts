import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

type UnitInstanceTx = {
    create(args: { data: { armyId: string; unitId: string; optionId: string | null; wounds: number; present: boolean }; select: { id: true } }): Promise<{ id: string }>;
    findUnique(args: { where: { id: string }; include: { weapons: true; upgrades: true } }): Promise<unknown>;
};

type UnitWeaponOptionDelegate = {
    findUnique(args: { where: { id: string }; select: { id: true; unitId: true; weapon1Id: true; weapon2Id: true } }): Promise<
        | { id: string; unitId: string; weapon1Id: string; weapon2Id: string | null }
        | null
    >;
};

type WeaponInstanceTx = {
    createMany(args: { data: Array<{ unitId: string; templateId: string; activeMods: string[] }> }): Promise<unknown>;
};

type Tx = {
    unitInstance: UnitInstanceTx;
    weaponInstance: WeaponInstanceTx;
};

type PrismaLike = {
    unitWeaponOption: UnitWeaponOptionDelegate;
    $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
};

const p = prisma as unknown as PrismaLike;

type AsyncCtx = { params: Promise<{ id: string }> };

const CreateUnitSchema = z.object({
    unitTemplateId: z.string().min(1),
    optionId: z.string().min(1), // UnitWeaponOption.id for the selected UnitTemplate
});

async function userHasWriteAccess(armyId: string, userId: string): Promise<boolean> {
    const army = await prisma.army.findUnique({
        where: { id: armyId },
        select: { ownerId: true },
    });
    if (!army) return false;
    if (army.ownerId === userId) return true;

    const share = await prisma.armyShare.findFirst({
        where: { armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

/**
 * Add a unit to an army:
 * - validate that optionId belongs to the provided UnitTemplate (unitTemplateId)
 * - create UnitInstance (selectedOptionId = optionId)
 * - based on option.weapon1Id / option.weapon2Id create 1-2 WeaponInstance rows
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

    // Permission check
    const can = await userHasWriteAccess(armyId, userId);
    if (!can) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    // Fetch option and validate ownership by template
    const option = await p.unitWeaponOption.findUnique({
        where: { id: optionId },
        select: {
            id: true,
            unitId: true,
            weapon1Id: true,
            weapon2Id: true,
        },
    });

    if (!option || option.unitId !== unitTemplateId) {
        return new Response(
            JSON.stringify({ error: 'Option does not belong to the provided unit template' }),
            { status: 400 },
        );
    }

    // Prepare weapon list (1-2 entries)
    const weaponIds = [option.weapon1Id, option.weapon2Id].filter(
        (x): x is string => typeof x === 'string' && x.length > 0,
    );
    if (weaponIds.length === 0) {
        return new Response(JSON.stringify({ error: 'Selected option has no weapons' }), { status: 400 });
    }

    const created = await p.$transaction(async (tx) => {
        const unit = await tx.unitInstance.create({
            data: {
                armyId,
                unitId: unitTemplateId,
                optionId: option.id,
                wounds: 0,
                present: true,
            },
            select: { id: true },
        });

        await tx.weaponInstance.createMany({
            data: weaponIds.map((wid) => ({
                unitId: unit.id,
                templateId: wid,
                activeMods: [],
            })),
        });

        return tx.unitInstance.findUnique({
            where: { id: unit.id },
            include: { weapons: true, upgrades: true },
        });
    });

    return new Response(JSON.stringify(created), { status: 201 });
}
