// src/app/army/[armyId]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import ArmyDashboardClient from '@/components/army/ArmyDashboardClient';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';

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
                    unit: {
                        include: {
                            startPerks: { include: { perk: { select: { name: true } } } },
                        },
                    },
                    upgrades: true,
                    weapons: true,
                    selectedOption: true,
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    });

    if (!army) return <div className="p-4 text-red-300">Nie znaleziono armii.</div>;

    const rules = await prisma.factionUpgradeRule.findMany({
        where: { factionId: army.factionId },
        select: { statKey: true, ratingPerPoint: true },
    });
    const ruleByKey = new Map<string, number>(rules.map((r) => [r.statKey, r.ratingPerPoint]));

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

    const unitsArr = army.units;
    type UnitRow = (typeof unitsArr)[number];

    function unitRating(u: UnitRow): number {
        const baseFromTemplate = u.unit.baseRating ?? 0;
        const optionRating = u.selectedOption?.rating ?? 0;

        const weaponDelta = u.weapons.reduce((acc, w) => {
            const t = weaponById.get(w.templateId);
            if (!t) return acc;
            const selected = new Set(w.activeMods.filter((m) => m.startsWith('__profile:')).map((m) => m.slice(10)));
            const sum = t.profiles.reduce((a, p) => (selected.has(p.id) ? a + (p.ratingDelta ?? 0) : a), 0);
            return acc + sum;
        }, 0);

        // ⬇️ TYLKO dodatnie stat-upy liczą się do ratingu
        const statsDelta = u.upgrades.reduce((acc, up) => {
            if (up.delta <= 0) return acc; // ignoruj rany
            const key = up.statKey === 'hp' ? 'hp' : up.statKey;
            const per = ruleByKey.get(key) ?? 0;
            return acc + up.delta * per;
        }, 0);

        return baseFromTemplate + optionRating + weaponDelta + statsDelta;
    }

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

        const bonus: BonusMap = { HP: 0, S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
        for (const up of u.upgrades) {
            if (up.statKey === 'hp') bonus.HP += up.delta;
            else if (isBonusKey(up.statKey)) bonus[up.statKey] += up.delta;
        }

        const weapons = u.weapons.map((w) => {
            const t = weaponById.get(w.templateId);

            const selectedProfileIds = w.activeMods
                .filter((m) => m.startsWith('__profile:'))
                .map((m) => m.slice(10));

            const baseEffects =
                (t?.baseEffects ?? []).map((be) => ({
                    id: String(be.id ?? be.effectId),
                    effectId: be.effectId,
                    name: be.effect.name,
                    kind: be.effect.kind as 'WEAPON' | 'CRITICAL',
                    valueInt: be.valueInt,
                })) ?? [];

            const profiles =
                (t?.profiles ?? []).map((p) => ({
                    id: p.id,
                    typeOverride: p.typeOverride ?? null,
                    testOverride: p.testOverride ?? null,
                    effects: p.effects.map((e) => ({
                        id: String(e.id ?? e.effectId),
                        effectId: e.effectId,
                        name: e.effect.name,
                        kind: e.effect.kind as 'WEAPON' | 'CRITICAL',
                        valueInt: e.valueInt,
                    })),
                    parts: ('parts' in p ? (p as unknown as { parts: number | null }).parts : null) ?? null,
                    rating: ('ratingDelta' in p ? (p as unknown as { ratingDelta: number | null }).ratingDelta : null) ?? null,
                })) ?? [];

            return {
                name: t?.name ?? `#${w.templateId.slice(0, 6)}`,
                selectedProfileIds,
                baseType: t?.baseType ?? '—',
                baseTest: t?.baseTest ?? '—',
                baseEffects,
                profiles,
            };
        });

        return {
            id: u.id,
            templateName: u.unit.name,
            roleTag: u.unit.roleTag,
            isLeader: (u.unit as unknown as { isLeader?: boolean }).isLeader ?? false,
            temporaryLeader: (u as unknown as { temporaryLeader?: boolean }).temporaryLeader ?? false,
            base,
            bonus,
            wounds: u.wounds,
            present: u.present,
            upgradesCount: u.upgrades.length,
            perkNames: [],
            startPerkNames: u.unit.startPerks.map((sp) => sp.perk.name),
            photoPath: u.photoPath ?? null,
            rating: unitRating(u),
            weapons,
        };
    });

    return (
        <MobilePageShell title={army.name} backHref="/">
            <ArmyDashboardClient
                armyId={army.id}
                armyName={army.name}
                tier={army.tier}
                factionId={army.faction.id}
                factionName={army.faction.name}
                resources={{ caps: army.caps, parts: army.parts, reach: army.reach, exp: army.exp }}
                units={uiUnits}
                rating={uiUnits.reduce((acc, u) => acc + u.rating, 0)}
                subfactionId={(army as unknown as { subfactionId?: string | null }).subfactionId ?? null}
            />
        </MobilePageShell>
    );
}
