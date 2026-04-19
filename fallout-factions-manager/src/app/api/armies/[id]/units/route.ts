import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };
type CompanionBehavior = 'COMPANION_ROBOT' | 'COMPANION_BEAST';

const CreateUnitSchema = z.object({
    unitTemplateId: z.string().min(1),
    optionId: z.string().min(1),
    temporary: z.boolean().optional(),
    companion: z
        .object({
            perkBehavior: z.enum(['COMPANION_ROBOT', 'COMPANION_BEAST']),
            unitTemplateId: z.string().min(1),
            optionId: z.string().min(1),
        })
        .optional(),
});

type OptionRow = {
    id: string;
    unitId: string;
    weapon1Id: string;
    weapon2Id: string | null;
    rating: number | null;
    unit: {
        id: string;
        roleTag: 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS' | null;
        baseRating: number | null;
        startPerks: Array<{ perk: { name: string } }>;
    };
};

type PerkRow = {
    id: string;
    behavior: string;
    isInnate: boolean;
};

type UnitInstanceTx = {
    create(args: {
        data: {
            armyId: string;
            unitId: string;
            optionId: string | null;
            displayOrder: number;
            wounds: number;
            present: boolean;
            temporary?: boolean;
            companionOwnerId?: string | null;
        };
        select: { id: true };
    }): Promise<{ id: string }>;
    findFirst(args: {
        where: { armyId: string };
        orderBy: [{ displayOrder: 'asc' | 'desc' }, { createdAt: 'asc' | 'desc' }];
        select: { displayOrder: true };
    }): Promise<{ displayOrder: number } | null>;
    findUnique(args: { where: { id: string }; include: { weapons: true; upgrades: true } }): Promise<unknown>;
};

type UnitChosenPerkTx = {
    create(args: { data: { unitId: string; perkId: string; valueInt: number | null } }): Promise<unknown>;
};

type WeaponInstanceTx = {
    createMany(args: { data: Array<{ unitId: string; templateId: string; activeMods: string[] }> }): Promise<unknown>;
};

type Tx = {
    unitInstance: UnitInstanceTx;
    unitChosenPerk: UnitChosenPerkTx;
    weaponInstance: WeaponInstanceTx;
};

type PrismaLike = {
    unitWeaponOption: {
        findUnique(args: {
            where: { id: string };
            include: {
                unit: {
                    select: {
                        id: true;
                        roleTag: true;
                        baseRating: true;
                        startPerks: { select: { perk: { select: { name: true } } } };
                    };
                };
            };
        }): Promise<OptionRow | null>;
    };
    perk: {
        findFirst(args: { where: { behavior: CompanionBehavior } }): Promise<PerkRow | null>;
    };
    $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
};

const p = prisma as unknown as PrismaLike;

async function userHasWriteAccess(armyId: string, userId: string): Promise<boolean> {
    const army = await prisma.army.findUnique({ where: { id: armyId }, select: { ownerId: true, deleted: true } });
    if (!army) return false;
    if (army.deleted) return false;
    if (army.ownerId === userId) return true;

    const share = await prisma.armyShare.findFirst({
        where: { armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

function extractWeaponIds(option: Pick<OptionRow, 'weapon1Id' | 'weapon2Id'>): string[] {
    return [option.weapon1Id, option.weapon2Id].filter(
        (x): x is string => typeof x === 'string' && x.length > 0,
    );
}

function hasStartPerk(unit: OptionRow['unit'], perkName: string): boolean {
    const needle = perkName.trim().toUpperCase();
    return unit.startPerks.some((sp) => sp.perk.name.trim().toUpperCase() === needle);
}

function companionRatingFromOption(option: OptionRow): number {
    const optionRating = option.rating ?? 0;
    const baseRating = option.unit.baseRating ?? 0;
    return optionRating !== 0 ? optionRating : baseRating;
}

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

    const can = await userHasWriteAccess(armyId, userId);
    if (!can) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const { unitTemplateId, optionId, companion } = parsed.data;
    const temporary = Boolean(parsed.data.temporary);

    const mainOption = await p.unitWeaponOption.findUnique({
        where: { id: optionId },
        include: {
            unit: {
                select: {
                    id: true,
                    roleTag: true,
                    baseRating: true,
                    startPerks: { select: { perk: { select: { name: true } } } },
                },
            },
        },
    });
    if (!mainOption || mainOption.unitId !== unitTemplateId) {
        return new Response(JSON.stringify({ error: 'Option does not belong to the provided unit template' }), {
            status: 400,
        });
    }
    const mainWeaponIds = extractWeaponIds(mainOption);
    if (mainWeaponIds.length === 0) {
        return new Response(JSON.stringify({ error: 'Selected option has no weapons' }), { status: 400 });
    }

    let companionOption: OptionRow | null = null;
    let companionPerk: PerkRow | null = null;
    let companionRatingBonus = 0;

    if (companion) {
        if (mainOption.unit.roleTag !== 'CHAMPION') {
            return new Response(
                JSON.stringify({ error: 'Companion perk can only be selected for Champion units.' }),
                { status: 400 },
            );
        }

        companionPerk = await p.perk.findFirst({
            where: { behavior: companion.perkBehavior },
        });
        if (!companionPerk) {
            return new Response(
                JSON.stringify({ error: `Missing perk with behavior ${companion.perkBehavior}.` }),
                { status: 400 },
            );
        }
        if (companionPerk.isInnate) {
            return new Response(
                JSON.stringify({ error: 'Companion perk must be a selectable non-innate perk.' }),
                { status: 400 },
            );
        }

        companionOption = await p.unitWeaponOption.findUnique({
            where: { id: companion.optionId },
            include: {
                unit: {
                    select: {
                        id: true,
                        roleTag: true,
                        baseRating: true,
                        startPerks: { select: { perk: { select: { name: true } } } },
                    },
                },
            },
        });
        if (!companionOption || companionOption.unitId !== companion.unitTemplateId) {
            return new Response(
                JSON.stringify({ error: 'Companion option does not belong to the provided companion template.' }),
                { status: 400 },
            );
        }
        if (companionOption.unit.roleTag !== 'COMPANION') {
            return new Response(
                JSON.stringify({ error: 'Selected companion unit must have COMPANION role.' }),
                { status: 400 },
            );
        }

        const isRobotCompanion = hasStartPerk(companionOption.unit, 'MACHINE');
        const isCreatureCompanion = hasStartPerk(companionOption.unit, 'BEAST');
        if (companion.perkBehavior === 'COMPANION_ROBOT' && !isRobotCompanion) {
            return new Response(
                JSON.stringify({ error: 'Roboteer can only select robot companions.' }),
                { status: 400 },
            );
        }
        if (companion.perkBehavior === 'COMPANION_BEAST' && !isCreatureCompanion) {
            return new Response(
                JSON.stringify({ error: 'Creature Tamer can only select creature companions.' }),
                { status: 400 },
            );
        }

        const companionWeaponIds = extractWeaponIds(companionOption);
        if (companionWeaponIds.length === 0) {
            return new Response(JSON.stringify({ error: 'Selected companion option has no weapons.' }), {
                status: 400,
            });
        }
        companionRatingBonus = companionRatingFromOption(companionOption);
    }

    const created = await p.$transaction(async (tx) => {
        const last = await tx.unitInstance.findFirst({
            where: { armyId },
            orderBy: [{ displayOrder: 'desc' }, { createdAt: 'desc' }],
            select: { displayOrder: true },
        });

        let nextDisplayOrder = (last?.displayOrder ?? -1) + 1;

        const champion = await tx.unitInstance.create({
            data: {
                armyId,
                unitId: mainOption.unitId,
                optionId: mainOption.id,
                displayOrder: nextDisplayOrder,
                wounds: 0,
                present: true,
                temporary,
            },
            select: { id: true },
        });
        await tx.weaponInstance.createMany({
            data: mainWeaponIds.map((wid) => ({
                unitId: champion.id,
                templateId: wid,
                activeMods: [],
            })),
        });

        let linkedCompanionId: string | null = null;
        if (companion && companionPerk && companionOption) {
            await tx.unitChosenPerk.create({
                data: {
                    unitId: champion.id,
                    perkId: companionPerk.id,
                    valueInt: companionRatingBonus,
                },
            });

            nextDisplayOrder += 1;
            const companionInstance = await tx.unitInstance.create({
                data: {
                    armyId,
                    unitId: companionOption.unitId,
                    optionId: companionOption.id,
                    displayOrder: nextDisplayOrder,
                    wounds: 0,
                    present: true,
                    companionOwnerId: champion.id,
                },
                select: { id: true },
            });
            linkedCompanionId = companionInstance.id;

            const companionWeaponIds = extractWeaponIds(companionOption);
            await tx.weaponInstance.createMany({
                data: companionWeaponIds.map((wid) => ({
                    unitId: companionInstance.id,
                    templateId: wid,
                    activeMods: [],
                })),
            });
        }

        return {
            championId: champion.id,
            companionId: linkedCompanionId,
            companionRatingBonus,
        };
    });

    return new Response(JSON.stringify(created), { status: 201 });
}
