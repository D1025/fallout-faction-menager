import { NextRequest } from 'next/server';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

type UnitTemplateTag = 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS';

type SubfactionRules = {
    id: string;
    factionId: string;
    unitAllows: Array<{ unitId: string }>;
    unitDenies: Array<{ unitId: string }>;
};

type SubfactionDelegate = {
    findUnique(args: {
        where: { id: string };
        select: {
            id: true;
            factionId: true;
            unitAllows: { select: { unitId: true } };
            unitDenies: { select: { unitId: true } };
        };
    }): Promise<SubfactionRules | null>;
};

type WeaponEffectRow = {
    effectId: string;
    valueInt: number | null;
    effect: { id: string; name: string; kind: 'WEAPON' | 'CRITICAL'; description: string; requiresValue: boolean };
};

type WeaponProfileRow = {
    id: string;
    order: number;
    typeOverride: string | null;
    testOverride: string | null;
    partsOverride: number | null;
    ratingDelta: number | null;
    effects: WeaponEffectRow[];
};

type WeaponTemplateRow = {
    id: string;
    name: string;
    imagePath: string | null;
    notes: string | null;
    baseType: string;
    baseTest: string;
    baseParts: number | null;
    baseRating: number | null;
    baseEffects: WeaponEffectRow[];
    profiles: WeaponProfileRow[];
};

type WeaponTemplateDelegate = {
    findMany(args: {
        where: { id: { in: string[] } };
        include: {
            baseEffects: { include: { effect: true } };
            profiles: { include: { effects: { include: { effect: true } } }; orderBy: { order: 'asc' } };
        };
    }): Promise<WeaponTemplateRow[]>;
};

type UnitOptionRow = {
    id: string;
    costCaps: number;
    rating: number | null;
    weapon1Id: string;
    weapon2Id: string | null;
    weapon1: { id: string; name: string } | null;
    weapon2: { id: string; name: string } | null;
};

type UnitTemplateRow = {
    id: string;
    name: string;
    roleTag: UnitTemplateTag | null;
    isLeader?: boolean;
    hp: number;
    s: number; p: number; e: number; c: number; i: number; a: number; l: number;
    options: UnitOptionRow[];
};

type UnitTemplateDelegate = {
    findMany(args: {
        where: unknown;
        include: {
            options: {
                include: {
                    weapon1: { select: { id: true; name: true } };
                    weapon2: { select: { id: true; name: true } };
                };
            };
        };
        orderBy: Array<{ name: 'asc' | 'desc' } | { id: 'asc' | 'desc' }>;
        take?: number;
    }): Promise<UnitTemplateRow[]>;
};

// Uwaga: po zmianie schema.prisma trzeba uruchomić `prisma generate`.
const p = prisma as unknown as {
    subfaction: SubfactionDelegate;
    unitTemplate: UnitTemplateDelegate;
    weaponTemplate: WeaponTemplateDelegate;
};

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const factionId = searchParams.get('factionId');
    const subfactionId = searchParams.get('subfactionId');

    const expand = (searchParams.get('expand') ?? '').toLowerCase();
    const expandWeapons = expand.split(',').map((x) => x.trim()).includes('weapons');

    const q = (searchParams.get('q') ?? '').trim();
    const roleTag = (searchParams.get('roleTag') ?? '').trim();

    const limitRaw = searchParams.get('limit');
    const limit = limitRaw ? Math.max(1, Math.min(50, Number(limitRaw) || 0)) : null;

    const cursor = (searchParams.get('cursor') ?? '').trim();
    const [afterName, afterId] = cursor ? cursor.split('|') : ['', ''];

    const nameWhere = q
        ? {
              name: {
                  contains: q,
                  mode: 'insensitive' as const,
              },
          }
        : {};

    const roleWhere = roleTag && roleTag !== 'ALL' ? { roleTag: roleTag as UnitTemplateTag } : {};

    const cursorWhere = limit && afterName && afterId
        ? {
              OR: [{ name: { gt: afterName } }, { name: afterName, id: { gt: afterId } }],
          }
        : {};

    const include = {
        options: {
            include: {
                weapon1: { select: { id: true, name: true } },
                weapon2: { select: { id: true, name: true } },
            },
        },
    } as const;

    // helper: mapuj templates + dociągnij opisy broni
    function collectWeaponIds(rows: UnitTemplateRow[]): string[] {
        const ids: string[] = [];
        for (const t of rows) {
            for (const o of t.options ?? []) {
                ids.push(o.weapon1Id);
                if (o.weapon2Id) ids.push(o.weapon2Id);
            }
        }
        return Array.from(new Set(ids));
    }

    async function loadWeaponsByIds(ids: string[]): Promise<Map<string, WeaponTemplateRow>> {
        if (ids.length === 0) return new Map();
        const weapons = await p.weaponTemplate.findMany({
            where: { id: { in: ids } },
            include: {
                baseEffects: { include: { effect: true } },
                profiles: { include: { effects: { include: { effect: true } } }, orderBy: { order: 'asc' } },
            },
        });
        return new Map(weapons.map((w) => [w.id, w] as const));
    }

    function mapWeapon(w: WeaponTemplateRow | undefined | null) {
        if (!w) return null;
        return {
            id: w.id,
            name: w.name,
            imagePath: w.imagePath ?? null,
            notes: w.notes ?? null,
            baseType: w.baseType ?? '',
            baseTest: w.baseTest ?? '',
            baseParts: w.baseParts ?? null,
            baseRating: w.baseRating ?? null,
            baseEffects: (w.baseEffects ?? []).map((be) => ({
                effectId: be.effectId,
                valueInt: be.valueInt ?? null,
                effect: {
                    id: be.effect.id,
                    name: be.effect.name,
                    kind: be.effect.kind,
                    description: be.effect.description,
                    requiresValue: be.effect.requiresValue,
                },
            })),
            profiles: (w.profiles ?? [])
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((p) => ({
                    id: p.id,
                    order: p.order ?? 0,
                    typeOverride: p.typeOverride ?? null,
                    testOverride: p.testOverride ?? null,
                    partsOverride: p.partsOverride ?? null,
                    ratingDelta: p.ratingDelta ?? null,
                    effects: (p.effects ?? []).map((e) => ({
                        effectId: e.effectId,
                        valueInt: e.valueInt ?? null,
                        effect: {
                            id: e.effect.id,
                            name: e.effect.name,
                            kind: e.effect.kind,
                            description: e.effect.description,
                            requiresValue: e.effect.requiresValue,
                        },
                    })),
                })),
        };
    }

    // Bez frakcji: zwróć globalne + wszystkie frakcyjne jak dotąd
    if (!factionId) {
        const rows = await p.unitTemplate.findMany({
            where: {
                ...nameWhere,
                ...roleWhere,
                ...cursorWhere,
            },
            include,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            take: limit ? limit + 1 : undefined,
        });

        const sliced = limit ? rows.slice(0, limit) : rows;
        const next = limit && rows.length > limit ? `${sliced[sliced.length - 1]!.name}|${sliced[sliced.length - 1]!.id}` : null;

        const weaponsById = expandWeapons ? await loadWeaponsByIds(collectWeaponIds(sliced)) : new Map();

        const items = sliced.map((t) => ({
            id: t.id,
            name: t.name,
            roleTag: t.roleTag,
            isLeader: Boolean((t as unknown as { isLeader?: boolean }).isLeader ?? false),
            factionId: null,
            stats: { hp: t.hp, s: t.s, p: t.p, e: t.e, c: t.c, i: t.i, a: t.a, l: t.l },
            options: (t.options ?? []).map((o) => ({
                id: o.id,
                costCaps: o.costCaps,
                rating: o.rating,
                weapon1Id: o.weapon1Id,
                weapon1Name: o.weapon1?.name ?? '',
                weapon2Id: o.weapon2Id ?? null,
                weapon2Name: o.weapon2?.name ?? null,
                weapon1: expandWeapons ? mapWeapon(weaponsById.get(o.weapon1Id)) : null,
                weapon2: expandWeapons && o.weapon2Id ? mapWeapon(weaponsById.get(o.weapon2Id)) : null,
            })),
        }));

        if (!limit) return new Response(JSON.stringify(items), { status: 200 });
        return new Response(JSON.stringify({ items, nextCursor: next }), { status: 200 });
    }

    // 1) baza: global + przypisane do frakcji
    const baseWhere = {
        OR: [{ isGlobal: true }, { factions: { some: { factionId } } }],
        // jeśli NIE wybrano subfrakcji: ukryj jednostki, które są "allow" w jakiejkolwiek subfrakcji tej frakcji
        ...(subfactionId
            ? {}
            : {
                  subfactionAllows: {
                      none: {
                          subfaction: { factionId },
                      },
                  },
              }),
        ...nameWhere,
        ...roleWhere,
        ...cursorWhere,
    };

    const [baseRows, sub] = await Promise.all([
        p.unitTemplate.findMany({
            where: baseWhere,
            include,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            take: limit ? limit + 1 : undefined,
        }),
        subfactionId
            ? p.subfaction.findUnique({
                  where: { id: subfactionId },
                  select: {
                      id: true,
                      factionId: true,
                      unitAllows: { select: { unitId: true } },
                      unitDenies: { select: { unitId: true } },
                  },
              })
            : Promise.resolve(null),
    ]);

    // jeśli podano subfactionId, ale nie istnieje albo nie należy do frakcji – traktuj jak brak subfrakcji
    const allowIds = new Set<string>();
    const denyIds = new Set<string>();

    if (sub && sub.factionId === factionId) {
        for (const a of sub.unitAllows) allowIds.add(a.unitId);
        for (const d of sub.unitDenies) denyIds.add(d.unitId);
    }

    // 2) dołóż allow (dodatkowe jednostki)
    const extraIds = [...allowIds].filter((id) => !denyIds.has(id));
    const extraRows =
        extraIds.length > 0
            ? await p.unitTemplate.findMany({
                  where: {
                      id: { in: extraIds },
                      ...nameWhere,
                      ...roleWhere,
                  },
                  include,
                  orderBy: [{ name: 'asc' }, { id: 'asc' }],
              })
            : [];

    // 3) final: baza + extra, minus deny
    const byId = new Map<string, UnitTemplateRow>();
    for (const r of limit ? baseRows.slice(0, limit) : baseRows) byId.set(r.id, r);
    for (const r of extraRows) byId.set(r.id, r);
    for (const id of denyIds) byId.delete(id);

    const rows = [...byId.values()].sort((a, b) => (a.name === b.name ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name)));

    const items = rows.map((t) => ({
        id: t.id,
        name: t.name,
        roleTag: t.roleTag,
        isLeader: Boolean((t as unknown as { isLeader?: boolean }).isLeader ?? false),
        factionId: null,
        stats: { hp: t.hp, s: t.s, p: t.p, e: t.e, c: t.c, i: t.i, a: t.a, l: t.l },
        options: (t.options ?? []).map((o) => ({
            id: o.id,
            costCaps: o.costCaps,
            rating: o.rating,
            weapon1Id: o.weapon1Id,
            weapon1Name: o.weapon1?.name ?? '',
            weapon2Id: o.weapon2Id ?? null,
            weapon2Name: o.weapon2?.name ?? null,
            weapon1: null as unknown,
            weapon2: null as unknown,
        })),
    }));

    if (expandWeapons) {
        const weaponsById = await loadWeaponsByIds(collectWeaponIds(rows));
        for (const it of items) {
            for (const o of it.options) {
                (o as { weapon1: unknown }).weapon1 = mapWeapon(weaponsById.get(o.weapon1Id));
                (o as { weapon2: unknown }).weapon2 = o.weapon2Id ? mapWeapon(weaponsById.get(o.weapon2Id)) : null;
            }
        }
    } else {
        for (const it of items) {
            for (const o of it.options) {
                (o as { weapon1: unknown }).weapon1 = null;
                (o as { weapon2: unknown }).weapon2 = null;
            }
        }
    }

    const nextCursor = limit && baseRows.length > limit ? `${baseRows[limit - 1]!.name}|${baseRows[limit - 1]!.id}` : null;

    if (!limit) return new Response(JSON.stringify(items), { status: 200 });
    return new Response(JSON.stringify({ items, nextCursor }), { status: 200 });
}
