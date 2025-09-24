// src/app/army/[armyId]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import ArmyDashboardClient from '@/components/army/ArmyDashboardClient';

type BonusKeys = 'HP' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L';
type BonusMap = Record<BonusKeys, number>;
function isBonusKey(k: string): k is Exclude<BonusKeys, 'HP'> {
    return k === 'S' || k === 'P' || k === 'E' || k === 'C' || k === 'I' || k === 'A' || k === 'L';
}

export default async function Page({ params }: { params: Promise<{ armyId: string }> }) {
    const { armyId } = await params;

    const army = await prisma.army.findUnique({
        where: { id: armyId },
        include: {
            faction: { select: { id: true, name: true } },
            units: {
                include: {
                    unit: true,
                    upgrades: true,
                    weapons: true, // dociągniemy szablony niżej
                    selectedOption: true,
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    });

    if (!army) return <div className="p-4 text-red-300">Nie znaleziono armii.</div>;

    // Zasady przeliczania ratingu za stat-upy
    const rules = await prisma.factionUpgradeRule.findMany({
        where: { factionId: army.factionId },
        select: { statKey: true, ratingPerPoint: true },
    });
    const ruleByKey = new Map<string, number>(rules.map((r) => [r.statKey, r.ratingPerPoint]));

    // Dociągnij szablony broni dla wszystkich WeaponInstance
    const allTemplateIds = Array.from(new Set(army.units.flatMap((u) => u.weapons.map((w) => w.templateId))));
    const templates =
        allTemplateIds.length > 0
            ? await prisma.weaponTemplate.findMany({
                where: { id: { in: allTemplateIds } },
                include: {
                    baseEffects: { include: { effect: true } },
                    profiles: { include: { effects: { include: { effect: true } } }, orderBy: { order: 'asc' } },
                },
            })
            : [];
    const weaponById = new Map(templates.map((t) => [t.id, t]));

    // >>> WAŻNE: wyprowadź typ z *lokalnej* stałej, nie bezpośrednio z `army`
    const unitsArr = army.units;
    type UnitRow = (typeof unitsArr)[number];

    function unitRating(u: UnitRow): number {
        const baseFromTemplate = u.unit.baseRating ?? 0;
        const optionRating = u.selectedOption?.rating ?? 0;

        // rating z profili broni (sumujemy Δ z wybranych profili)
        const weaponDelta = u.weapons.reduce((acc, w) => {
            const t = weaponById.get(w.templateId);
            if (!t) return acc;
            const selected = new Set(w.activeMods.filter((m) => m.startsWith('__profile:')).map((m) => m.slice(10)));
            const sum = t.profiles.reduce((a, p) => (selected.has(p.id) ? a + (p.ratingDelta ?? 0) : a), 0);
            return acc + sum;
        }, 0);

        // rating z ulepszeń statów (SUM(delta*rule))
        const statsDelta = u.upgrades.reduce((acc, up) => {
            const key = up.statKey === 'hp' ? 'hp' : up.statKey;
            const per = ruleByKey.get(key) ?? 0;
            return acc + up.delta * per;
        }, 0);

        return baseFromTemplate + optionRating + weaponDelta + statsDelta;
    }

    // Mapuj jednostki do UI
    const uiUnits = unitsArr.map((u) => {
        const base = {
            hp: u.unit.hp,
            S: u.unit.s,
            P: u.unit.p,
            E: u.unit.e,
            C: u.unit.c,
            I: u.unit.i,
            A: u.unit.a,
            L: u.unit.l,
        };

        // Bonus z ulepszeń (na SPECIAL i HP)
        const bonus: BonusMap = { HP: 0, S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
        for (const up of u.upgrades) {
            if (up.statKey === 'hp') {
                bonus.HP += up.delta;
            } else if (isBonusKey(up.statKey)) {
                bonus[up.statKey] += up.delta;
            }
        }

        // Tabela broni do kart
        const weapons = u.weapons.map((w) => {
            const t = weaponById.get(w.templateId);
            const selected = new Set(w.activeMods.filter((m) => m.startsWith('__profile:')).map((m) => m.slice(10)));

            // połącz bazowe efekty + z profili
            const allEffects = new Map<string, { name: string; kind: 'WEAPON' | 'CRITICAL'; valueInt: number | null }>();
            for (const be of t?.baseEffects ?? []) {
                const key = `${be.effect.kind}:${be.effect.name}:${be.valueInt ?? ''}`;
                allEffects.set(key, { name: be.effect.name, kind: be.effect.kind, valueInt: be.valueInt });
            }
            for (const p of t?.profiles ?? []) {
                if (!selected.has(p.id)) continue;
                for (const e of p.effects) {
                    const key = `${e.effect.kind}:${e.effect.name}:${e.valueInt ?? ''}`;
                    allEffects.set(key, { name: e.effect.name, kind: e.effect.kind, valueInt: e.valueInt });
                }
            }
            const traits = [...allEffects.values()]
                .filter((e) => e.kind === 'WEAPON')
                .map((e) => `${e.name}${e.valueInt != null ? ` (${e.valueInt})` : ''}`);
            const crits = [...allEffects.values()].filter((e) => e.kind === 'CRITICAL').map((e) => e.name);

            // do wyświetlenia typ/test – ostatni zaznaczony profil (fallback: baza)
            const selectedArr = [...selected];
            const last = selectedArr.length ? t?.profiles.find((p) => p.id === selectedArr[selectedArr.length - 1]) : undefined;

            return {
                name: t?.name ?? `#${w.templateId.slice(0, 6)}`,
                type: last?.typeOverride ?? t?.baseType ?? '—',
                test: last?.testOverride ?? t?.baseTest ?? '—',
                traits,
                crits,
            };
        });

        return {
            id: u.id,
            templateName: u.unit.name,
            roleTag: u.unit.roleTag,
            base,
            bonus,
            wounds: u.wounds,
            present: u.present,
            upgradesCount: u.upgrades.length,
            perkNames: [],
            photoPath: u.photoPath ?? null,
            rating: unitRating(u),
            weapons,
        };
    });

    const armyRating = uiUnits.reduce((a, u) => a + u.rating, 0);

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-3">
                    <div className="text-base font-semibold">Armia</div>
                </div>
            </header>

            <main className="mx-auto max-w-screen-sm px-3 pb-24">
                <ArmyDashboardClient
                    armyId={army.id}
                    armyName={army.name}
                    tier={army.tier}
                    factionName={army.faction.name}
                    resources={{ caps: army.caps, parts: army.parts, reach: army.reach }}
                    units={uiUnits}
                    rating={armyRating}
                />
            </main>
        </div>
    );
}
