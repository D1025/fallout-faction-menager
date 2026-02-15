import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

// helpery odczytu z obiektu o nieaktualnych typach Prisma w edytorze
function readBool(obj: unknown, key: string): boolean {
    if (!obj || typeof obj !== 'object') return false;
    const v = (obj as Record<string, unknown>)[key];
    return v === true;
}

function readString(obj: unknown, key: string): string | null {
    if (!obj || typeof obj !== 'object') return null;
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === 'string' ? v : null;
}

function readNumber(obj: unknown, key: string): number | null {
    if (!obj || typeof obj !== 'object') return null;
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

type UnitChosenPerkDelegate = {
    create(args: { data: { unitId: string; perkId: string; valueInt: number | null }; select: { id: true } }): Promise<{ id: string }>;
    findMany(args: { where: { unitId: string }; select: { perkId: true; valueInt: true }; orderBy: { perkId: 'asc' | 'desc' } }): Promise<Array<{ perkId: string; valueInt: number | null }>>;
};

const p = prisma as unknown as { unitChosenPerk: UnitChosenPerkDelegate };

type UnitChosenPerkDeleteDelegate = {
    deleteMany(args: { where: { unitId: string; perkId: string } }): Promise<{ count: number }>;
};

const pDel = prisma as unknown as { unitChosenPerk: UnitChosenPerkDeleteDelegate };

// dopasowane do nazwy folderu: [id]
type Ctx = { params: Promise<{ id: string }> };

const Input = z.object({ perkId: z.string().min(1) });

async function canWriteByUnit(unitId: string, userId: string) {
    const u = await prisma.unitInstance.findUnique({
        where: { id: unitId },
        include: { army: true },
    });
    if (!u) return false;
    if (u.army.ownerId === userId) return true;
    const share = await prisma.armyShare.findFirst({
        where: { armyId: u.armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

export async function POST(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    const unitId = id; // <-- nazwę ujednolicamy lokalnie

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = Input.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    const { perkId } = parsed.data;

    const ok = await canWriteByUnit(unitId, userId);
    if (!ok) return new Response('FORBIDDEN', { status: 403 });

    const perkAny = await prisma.perk.findUnique({ where: { id: perkId } });
    if (!perkAny) return new Response('NOT_FOUND', { status: 404 });

    const perkRequiresValue = readBool(perkAny, 'requiresValue');
    const perkIsInnate = readBool(perkAny, 'isInnate');
    const perkCategory = (readString(perkAny, 'category') ?? 'REGULAR') as 'REGULAR' | 'AUTOMATRON';
    const perkStatKey = (readString(perkAny, 'statKey') ?? '').trim().toUpperCase();
    const perkMinValue = readNumber(perkAny, 'minValue');
    const isSpecialLinked = Boolean(perkStatKey && perkMinValue != null);

    if (perkIsInnate && !isSpecialLinked) {
        return new Response(JSON.stringify({ error: 'Perk is INNATE and cannot be added to unit in army.' }), { status: 400 });
    }

    if (!isSpecialLinked) {
        return new Response(JSON.stringify({ error: 'Only SPECIAL-linked perks can be added here.' }), { status: 400 });
    }
    const requiredMinValue = perkMinValue as number;

    // sprawdź czy jednostka ma startowy INNATE perk "ALL THE TOYS"
    const unitWithStartPerks = await prisma.unitInstance.findUnique({
        where: { id: unitId },
        select: {
            id: true,
            upgrades: { select: { statKey: true, delta: true } },
            unit: {
                select: {
                    s: true,
                    p: true,
                    e: true,
                    c: true,
                    i: true,
                    a: true,
                    l: true,
                    startPerks: { select: { perk: { select: { name: true } } } },
                },
            },
        },
    });
    if (!unitWithStartPerks) return new Response('NOT_FOUND', { status: 404 });

    const hasAllTheToys = unitWithStartPerks.unit.startPerks
        .some((sp) => sp.perk.name.trim().toUpperCase() === 'ALL THE TOYS');

    if (perkCategory === 'AUTOMATRON' && !hasAllTheToys) {
        return new Response(JSON.stringify({ error: 'Automatron perks require INNATE perk ALL THE TOYS on this unit template.' }), { status: 400 });
    }

    if (perkCategory === 'REGULAR' && hasAllTheToys) {
        return new Response(JSON.stringify({ error: 'This unit has ALL THE TOYS and can only take Automatron perks.' }), { status: 400 });
    }

    const finalSpecial: Record<'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L', number> = {
        S: unitWithStartPerks.unit.s,
        P: unitWithStartPerks.unit.p,
        E: unitWithStartPerks.unit.e,
        C: unitWithStartPerks.unit.c,
        I: unitWithStartPerks.unit.i,
        A: unitWithStartPerks.unit.a,
        L: unitWithStartPerks.unit.l,
    };
    for (const up of unitWithStartPerks.upgrades) {
        const key = (up.statKey ?? '').toUpperCase();
        if (key === 'S' || key === 'P' || key === 'E' || key === 'C' || key === 'I' || key === 'A' || key === 'L') {
            finalSpecial[key] += up.delta;
        }
    }

    if (perkStatKey !== 'S' && perkStatKey !== 'P' && perkStatKey !== 'E' && perkStatKey !== 'C' && perkStatKey !== 'I' && perkStatKey !== 'A' && perkStatKey !== 'L') {
        return new Response(JSON.stringify({ error: 'Perk has invalid SPECIAL requirement.' }), { status: 400 });
    }
    if (finalSpecial[perkStatKey] < requiredMinValue) {
        return new Response(
            JSON.stringify({ error: `SPECIAL requirement not met: ${perkStatKey} ${requiredMinValue} (current ${finalSpecial[perkStatKey]}).` }),
            { status: 400 },
        );
    }

    if (perkRequiresValue) {
        return new Response(
            JSON.stringify({ error: 'Perk requires value. Użyj endpointu z valueInt (TODO).' }),
            { status: 400 },
        );
    }

    // upewniamy się, że unit istnieje
    const exists = await prisma.unitInstance.findUnique({ where: { id: unitId }, select: { id: true } });
    if (!exists) return new Response('NOT_FOUND', { status: 404 });

    try {
        await p.unitChosenPerk.create({
            data: { unitId, perkId, valueInt: null },
            select: { id: true },
        });
    } catch {
        // @@unique([unitId, perkId]) -> duplikat
        return new Response(JSON.stringify({ ok: true, duplicated: true }), { status: 200 });
    }

    const chosen = await p.unitChosenPerk.findMany({
        where: { unitId },
        select: { perkId: true, valueInt: true },
        orderBy: { perkId: 'asc' },
    });

    return new Response(JSON.stringify({ ok: true, unitId, chosenPerks: chosen }), { status: 200 });
}

export async function DELETE(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    const unitId = id;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = Input.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    const { perkId } = parsed.data;

    const ok = await canWriteByUnit(unitId, userId);
    if (!ok) return new Response('FORBIDDEN', { status: 403 });

    // Sprawdź, czy perk istnieje i czy jest INNATE
    const perkAny = await prisma.perk.findUnique({ where: { id: perkId } });
    if (!perkAny) return new Response('NOT_FOUND', { status: 404 });
    const perkIsInnate = readBool(perkAny, 'isInnate');
    const perkStatKey = (readString(perkAny, 'statKey') ?? '').trim().toUpperCase();
    const perkMinValue = readNumber(perkAny, 'minValue');
    const isSpecialLinked = Boolean(perkStatKey && perkMinValue != null);
    if (perkIsInnate && !isSpecialLinked) {
        return new Response(JSON.stringify({ error: 'INNATE perks cannot be removed.' }), { status: 400 });
    }

    // Usuń tylko z chosen perks (perki wybrane w armii). Startowe INNATE perki są w template i nie są tu dotykane.
    const r = await pDel.unitChosenPerk.deleteMany({ where: { unitId, perkId } });

    return new Response(JSON.stringify({ ok: true, removed: r.count }), { status: 200 });
}
