// app/admin/subfactions/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { AdminSubfactionsClient } from '@/components/AdminSubfactionsClient';

export type SubfactionDTO = {
    id: string;
    name: string;
    factionId: string;
    unitAllowIds: string[];
    unitDenyIds: string[];
};

export type UnitTemplateDTO = {
    id: string;
    name: string;
    isGlobal: boolean;
    factionIds: string[];
};

type RawUnitTemplate = {
    id: string;
    name: string;
    isGlobal: boolean;
    factions: Array<{ factionId: string }>;
};

type RawSubfaction = {
    id: string;
    name: string;
    factionId: string;
    unitAllows: Array<{ unitId: string }>;
    unitDenies: Array<{ unitId: string }>;
};

// We intentionally avoid stricter delegate typing here; runtime Prisma delegate is correct.
// Minimal local typing for result mapping.

export default async function AdminSubfactionsPage() {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return <div className="p-4 text-red-300">Access denied.</div>;

    const [factions, rawUnits, subs] = await Promise.all([
        prisma.faction.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.unitTemplate.findMany({ include: { factions: true }, orderBy: [{ name: 'asc' }] }) as unknown as RawUnitTemplate[],
        prisma.subfaction.findMany({
            select: {
                id: true,
                name: true,
                factionId: true,
                unitAllows: { select: { unitId: true } },
                unitDenies: { select: { unitId: true } },
            },
            orderBy: [{ factionId: 'asc' }, { name: 'asc' }],
        }) as unknown as RawSubfaction[],
    ]);

    const units: UnitTemplateDTO[] = rawUnits
        .map((u: RawUnitTemplate) => ({ id: u.id, name: u.name, isGlobal: u.isGlobal, factionIds: u.factions.map((f) => f.factionId) }))
        .sort((a: UnitTemplateDTO, b: UnitTemplateDTO) => (a.isGlobal === b.isGlobal ? a.name.localeCompare(b.name) : a.isGlobal ? -1 : 1));

    const subfactions: SubfactionDTO[] = subs.map((s: RawSubfaction) => ({
        id: s.id,
        name: s.name,
        factionId: s.factionId,
        unitAllowIds: s.unitAllows.map((x: { unitId: string }) => x.unitId),
        unitDenyIds: s.unitDenies.map((x: { unitId: string }) => x.unitId),
    }));

    return (
        <MobilePageShell title="Subfactions (admin)" backHref="/admin">
            <AdminSubfactionsClient factions={factions} initialSubfactions={subfactions} unitTemplates={units} />
        </MobilePageShell>
    );
}
