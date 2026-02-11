import { NextRequest } from 'next/server';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

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

// Uwaga: po zmianie schema.prisma trzeba uruchomić `prisma generate`.
const p = prisma as unknown as { subfaction: SubfactionDelegate };

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const factionId = searchParams.get('factionId');
    const subfactionId = searchParams.get('subfactionId');

    // Bez frakcji: zwróć globalne + wszystkie frakcyjne jak dotąd
    if (!factionId) {
        const rows = await prisma.unitTemplate.findMany({
            include: {
                options: {
                    include: {
                        weapon1: { select: { id: true, name: true } },
                        weapon2: { select: { id: true, name: true } },
                    },
                },
                factions: true,
            },
            orderBy: [{ name: 'asc' }],
        });

        const data = rows.map((t) => ({
            id: t.id,
            name: t.name,
            roleTag: t.roleTag,
            factionId: null, // zachowujemy kompatybilność frontendową
            options: t.options.map((o) => ({
                id: o.id,
                costCaps: o.costCaps,
                rating: o.rating,
                weapon1Id: o.weapon1Id,
                weapon1Name: o.weapon1?.name ?? '',
                weapon2Id: o.weapon2Id ?? null,
                weapon2Name: o.weapon2?.name ?? null,
            })),
        }));

        return new Response(JSON.stringify(data), { status: 200 });
    }

    // 1) baza: global + przypisane do frakcji
    const baseWhere = {
        OR: [
            { isGlobal: true },
            { factions: { some: { factionId } } },
        ],
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
    };

    const [baseRows, sub] = await Promise.all([
        prisma.unitTemplate.findMany({
            where: baseWhere,
            include: {
                options: {
                    include: {
                        weapon1: { select: { id: true, name: true } },
                        weapon2: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: [{ name: 'asc' }],
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
            ? await prisma.unitTemplate.findMany({
                  where: { id: { in: extraIds } },
                  include: {
                      options: {
                          include: {
                              weapon1: { select: { id: true, name: true } },
                              weapon2: { select: { id: true, name: true } },
                          },
                      },
                  },
              })
            : [];

    // 3) final: baza + extra, minus deny
    const byId = new Map<string, (typeof baseRows)[number]>();
    for (const r of baseRows) byId.set(r.id, r);
    for (const r of extraRows) byId.set(r.id, r);
    for (const id of denyIds) byId.delete(id);

    const rows = [...byId.values()].sort((a, b) => {
        return a.name.localeCompare(b.name);
    });

    const data = rows.map((t) => ({
        id: t.id,
        name: t.name,
        roleTag: t.roleTag,
        factionId: null,
        options: t.options.map((o: (typeof t.options)[number]) => ({
            id: o.id,
            costCaps: o.costCaps,
            rating: o.rating,
            weapon1Id: o.weapon1Id,
            weapon1Name: o.weapon1?.name ?? '',
            weapon2Id: o.weapon2Id ?? null,
            weapon2Name: o.weapon2?.name ?? null,
        })),
    }));

    return new Response(JSON.stringify(data), { status: 200 });
}
