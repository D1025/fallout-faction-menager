// app/admin/templates/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from "next/link";
import { prisma } from "@/server/prisma";
import { AdminUnitTemplatesClient } from "@/components/AdminUnitTemplatesClient";

/** DTO do komponentu klientowego */
export type FactionDTO = { id: string; name: string };
export type PerkDTO = {
    id: string;
    name: string;
    requiresValue: boolean;
    startAllowed: boolean;
    behavior: "NONE" | "COMPANION_ROBOT" | "COMPANION_BEAST";
};
export type WeaponDTO = { id: string; name: string };

export type UnitTemplateDTO = {
    id: string;
    name: string;
    isGlobal: boolean;
    factionIds: string[];
    roleTag: string | null;

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
    roleTag: string | null;
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

export default async function TemplatesAdminPage() {
    const [rawTemplates, factions, perks, weapons] = await Promise.all([
        p.unitTemplate.findMany({
            include: { options: true, startPerks: true, factions: true },
            orderBy: [{ name: 'asc' }],
        }),
        prisma.faction.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.perk.findMany({
            select: { id: true, name: true, requiresValue: true, startAllowed: true, behavior: true },
            orderBy: [{ behavior: 'asc' }, { name: 'asc' }],
        }),
        prisma.weaponTemplate.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);

    const templates: UnitTemplateDTO[] = rawTemplates
        .map((t) => ({
            id: t.id,
            name: t.name,
            isGlobal: t.isGlobal,
            factionIds: t.factions.map((x) => x.factionId),
            roleTag: t.roleTag ?? null,
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
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-3">
                    <div className="text-base font-semibold">Szablony jednostek (admin)</div>
                    <Link href="/admin" className="text-sm text-zinc-300">← Wróć</Link>
                </div>
            </header>
            <main className="mx-auto max-w-screen-sm px-3 pb-24">
                <AdminUnitTemplatesClient
                    initial={templates}
                    factions={factions.map(f => ({ id: f.id, name: f.name ?? "" }))}
                    perks={perks as PerkDTO[]}
                    weapons={weapons as WeaponDTO[]}
                />
            </main>
        </div>
    );
}
