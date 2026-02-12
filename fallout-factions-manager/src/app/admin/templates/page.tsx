// app/admin/templates/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from "@/server/prisma";
import { AdminUnitTemplatesClient } from "@/components/AdminUnitTemplatesClient";
import { AppHeader } from '@/components/nav/AppHeader';

/** DTO do komponentu klientowego */
export type FactionDTO = { id: string; name: string };
export type PerkDTO = {
    id: string;
    name: string;
    requiresValue: boolean;
    startAllowed: boolean;
    behavior: "NONE" | "COMPANION_ROBOT" | "COMPANION_BEAST";
    isInnate: boolean;
    category: 'REGULAR' | 'AUTOMATRON';
};
export type WeaponDTO = { id: string; name: string };

export type UnitTemplateTag = 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS';

export type UnitTemplateDTO = {
    id: string;
    name: string;
    isGlobal: boolean;
    factionIds: string[];
    roleTag: UnitTemplateTag | null;
    isLeader: boolean;

    hp: number;
    s: number; p: number; e: number; c: number; i: number; a: number; l: number;
    baseRating: number | null;

    options: Array<{ weapon1Id: string; weapon2Id: string | null; costCaps: number; rating: number | null }>;
    startPerks: Array<{ perkId: string; valueInt: number | null }>;
};

type RawTemplate = {
    id: string;
    name: string;
    isGlobal: boolean;
    roleTag: UnitTemplateTag | null;
    isLeader?: boolean;
    hp: number;
    s: number; p: number; e: number; c: number; i: number; a: number; l: number;
    baseRating: number | null;
    options: Array<{ weapon1Id: string; weapon2Id: string | null; costCaps: number; rating: number | null }>;
    startPerks: Array<{ perkId: string; valueInt: number | null }>;
    factions: Array<{ factionId: string }>;
};

type UnitTemplateDelegate = {
    findMany(args: {
        include: { options: true; startPerks: true, factions: true };
        orderBy: Array<{ name: 'asc' | 'desc' }>;
    }): Promise<RawTemplate[]>;
};

const p = prisma as unknown as { unitTemplate: UnitTemplateDelegate };

type PerkRow = {
    id: string;
    name: string;
    requiresValue: boolean;
    startAllowed: boolean;
    behavior: "NONE" | "COMPANION_ROBOT" | "COMPANION_BEAST";
    isInnate?: boolean;
    category?: 'REGULAR' | 'AUTOMATRON';
};

export default async function TemplatesAdminPage() {
    const [rawTemplates, factions, perksRaw, weapons] = await Promise.all([
        p.unitTemplate.findMany({
            include: { options: true, startPerks: true, factions: true },
            orderBy: [{ name: 'asc' }],
        }),
        prisma.faction.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        (prisma.perk.findMany({
            orderBy: [{ behavior: 'asc' }, { name: 'asc' }],
        }) as unknown as Promise<PerkRow[]>),
        prisma.weaponTemplate.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);

    const perks: PerkDTO[] = perksRaw
        .map((x) => ({
            id: x.id,
            name: x.name,
            requiresValue: Boolean(x.requiresValue),
            startAllowed: Boolean(x.startAllowed),
            behavior: x.behavior,
            isInnate: Boolean(x.isInnate ?? false),
            category: (x.category ?? 'REGULAR') as 'REGULAR' | 'AUTOMATRON',
        }))
        .sort((a, b) =>
            a.category === b.category
                ? a.isInnate === b.isInnate
                    ? a.behavior === b.behavior
                        ? a.name.localeCompare(b.name)
                        : a.behavior.localeCompare(b.behavior)
                    : a.isInnate
                        ? -1
                        : 1
                : a.category.localeCompare(b.category)
        );

    const templates: UnitTemplateDTO[] = rawTemplates
        .map((t) => ({
            id: t.id,
            name: t.name,
            isGlobal: t.isGlobal,
            factionIds: t.factions.map((x) => x.factionId),
            roleTag: t.roleTag ?? null,
            isLeader: Boolean((t as unknown as { isLeader?: boolean }).isLeader ?? false),
            hp: t.hp, s: t.s, p: t.p, e: t.e, c: t.c, i: t.i, a: t.a, l: t.l,
            baseRating: t.baseRating ?? null,
            options: t.options.map((o) => ({
                weapon1Id: o.weapon1Id,
                weapon2Id: o.weapon2Id ?? null,
                costCaps: o.costCaps,
                rating: o.rating ?? null,
            })),
            startPerks: t.startPerks.map((sp) => ({ perkId: sp.perkId, valueInt: sp.valueInt ?? null })),
        }))
        .sort((a, b) => (a.isGlobal === b.isGlobal ? a.name.localeCompare(b.name) : a.isGlobal ? -1 : 1));

    return (
        <div className="min-h-dvh">
            <AppHeader title="Szablony jednostek (admin)" backHref="/admin" />
            <main className="app-shell">
                <AdminUnitTemplatesClient
                    initial={templates}
                    factions={factions.map(f => ({ id: f.id, name: f.name ?? "" }))}
                    perks={perks}
                    weapons={weapons as WeaponDTO[]}
                />
            </main>
        </div>
    );
}
