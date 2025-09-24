export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import { UnitClient } from '@/components/army/UnitClient';

type UiStatKey = 'HP' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L';
type StatKey = 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L' | 'hp';
function isStatKey(x: string): x is StatKey {
    return x === 'hp' || x === 'S' || x === 'P' || x === 'E' || x === 'C' || x === 'I' || x === 'A' || x === 'L';
}

export default async function Page({ params }: { params: Promise<{ armyId: string; unitId: string }> }) {
    const { unitId } = await params;

    const unit = await prisma.unitInstance.findUnique({
        where: { id: unitId },
        include: {
            unit: {
                select: { id: true, name: true, roleTag: true, hp: true, s: true, p: true, e: true, c: true, i: true, a: true, l: true, baseRating: true },
            },
            upgrades: true,
            weapons: true,
        },
    });
    if (!unit) return <div className="p-4 text-red-300">Nie znaleziono jednostki.</div>;

    // dociągnięcie szablonów broni + profili + bazowych efektów
    const templateIds = unit.weapons.map((w) => w.templateId);
    const templates = templateIds.length
        ? await prisma.weaponTemplate.findMany({
            where: { id: { in: templateIds } },
            include: {
                baseEffects: { include: { effect: true } },
                profiles: { include: { effects: { include: { effect: true } } }, orderBy: { order: 'asc' } },
            },
        })
        : [];
    const byId = new Map(templates.map((t) => [t.id, t]));

    // UI broni: każdy profil to "efektywny" wpis (baza + override)
    const weapons = unit.weapons.map((w) => {
        const t = byId.get(w.templateId);
        const selected = new Set(w.activeMods.filter((m) => m.startsWith('__profile:')).map((m) => m.slice(10)));

        const profiles =
            t?.profiles.map((p) => ({
                id: p.id,
                // zastosuj override na bazie
                type: p.typeOverride ?? t.baseType ?? '',
                test: p.testOverride ?? t.baseTest ?? '',
                parts: p.partsOverride ?? t.baseParts ?? null,
                rating: p.ratingDelta ?? null,
                effects: p.effects.map((e) => ({
                    id: e.effectId,
                    name: e.effect.name,
                    kind: e.effect.kind as 'WEAPON' | 'CRITICAL',
                    valueInt: e.valueInt,
                })),
            })) ?? [];

        return {
            id: w.id,
            name: t?.name ?? `#${w.templateId.slice(0, 6)}`,
            selectedProfileIds: [...selected],
            baseEffects:
                t?.baseEffects.map((be) => ({
                    id: be.effectId,
                    name: be.effect.name,
                    kind: be.effect.kind as 'WEAPON' | 'CRITICAL',
                    valueInt: be.valueInt,
                })) ?? [],
            profiles,
        };
    });

    const special: Record<UiStatKey, number> = {
        HP: unit.unit?.hp ?? 3,
        S: unit.unit?.s ?? 5,
        P: unit.unit?.p ?? 5,
        E: unit.unit?.e ?? 5,
        C: unit.unit?.c ?? 5,
        I: unit.unit?.i ?? 5,
        A: unit.unit?.a ?? 5,
        L: unit.unit?.l ?? 5,
    };

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-3">
                    <a href={`/army/${unit.armyId}`} className="text-sm text-zinc-300">
                        ← Wróć
                    </a>
                    <div className="text-base font-semibold">{unit.unit?.name ?? unit.id.slice(0, 6)}</div>
                    <div className="text-xs text-zinc-400">&nbsp;</div>
                </div>
            </header>

            <main className="mx-auto max-w-screen-sm px-3 pb-24">
                <UnitClient
                    unitId={unit.id}
                    armyId={unit.armyId}
                    name={unit.unit?.name ?? unit.id.slice(0, 6)}
                    roleTag={unit.unit?.roleTag ?? null}
                    present={unit.present}
                    wounds={unit.wounds}
                    special={special}
                    upgrades={unit.upgrades.map((u) => ({
                        id: u.id,
                        statKey: isStatKey(u.statKey) ? u.statKey : 'S',
                        delta: u.delta,
                        at: u.at.toISOString(),
                    }))}
                    weapons={weapons}
                />
            </main>
        </div>
    );
}
