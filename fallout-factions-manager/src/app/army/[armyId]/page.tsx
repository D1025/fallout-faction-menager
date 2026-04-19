// src/app/army/[armyId]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { ArmyPageClient } from '@/components/army/ArmyPageClient';
import {
    buildTrainingRuleLookup,
    getUpgradeRatingPerPointForUnit,
    resolveEffectiveTrainingFactionId,
    type TrainingRuleLookup,
} from '@/lib/rules/trainingTable';

type BonusKeys = 'HP' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L';
type BonusMap = Record<BonusKeys, number>;
function isBonusKey(k: string): k is Exclude<BonusKeys, 'HP'> {
    return k === 'S' || k === 'P' || k === 'E' || k === 'C' || k === 'I' || k === 'A' || k === 'L';
}

const p = prisma as unknown as {
    factionUpgradeRule: {
        findMany: (args: unknown) => Promise<unknown[]>;
    };
};

type ArmyPerkRow = {
    id: string;
    name: string;
    description: string | null;
    behavior?: 'NONE' | 'COMPANION_ROBOT' | 'COMPANION_BEAST';
};

type ArmyUnitTemplateRow = {
    name: string;
    roleTag: string | null;
    hp: number;
    s: number;
    p: number;
    e: number;
    c: number;
    i: number;
    a: number;
    l: number;
    baseRating: number | null;
    isLeader?: boolean;
    startPerks: Array<{ perk: ArmyPerkRow }>;
};

type ArmyUnitRow = {
    id: string;
    wounds: number;
    present: boolean;
    photoPath: string | null;
    photoEtag?: string | null;
    temporaryLeader?: boolean;
    temporary?: boolean;
    capturedAt?: Date | null;
    unit: ArmyUnitTemplateRow;
    upgrades: Array<{ statKey: string; delta: number; trainingFactionId?: string | null }>;
    weapons: Array<{ templateId: string; activeMods: string[] }>;
    selectedOption: { rating: number | null } | null;
    capturedByArmy: { id: string; name: string; faction: { name: string } } | null;
    chosenPerks: Array<{ valueInt: number | null; perk: ArmyPerkRow }>;
};

type ArmyPageData = {
    id: string;
    name: string;
    tier: number;
    deleted: boolean;
    factionId: string;
    caps: number;
    parts: number;
    scout: number;
    reach: number;
    exp: number;
    ploys: number;
    ownerId: string;
    subfactionId: string | null;
    faction: {
        id: string;
        name: string;
        limits: Array<{ tag: string; tier1: number | null; tier2: number | null; tier3: number | null }>;
    };
    playedOpponents: Array<{
        boxesChecked: number;
        updatedAt: Date;
        opponentArmy: {
            factionId: string;
            faction: { name: string };
        };
    }>;
    units: ArmyUnitRow[];
};

type WeaponTemplateRow = {
    id: string;
    name: string;
    baseType: string;
    baseTest: string;
    baseEffects: Array<{
        id?: string;
        effectId: string;
        valueInt: number | null;
        valueText?: string | null;
        effect: { name: string; kind: 'WEAPON' | 'CRITICAL' | string };
    }>;
    profiles: Array<{
        id: string;
        typeOverride: string | null;
        testOverride: string | null;
        ratingDelta: number | null;
        parts?: number | null;
        effects: Array<{
            id?: string;
            effectId: string;
            valueInt: number | null;
            valueText?: string | null;
            effectMode?: 'ADD' | 'REMOVE';
            effect: { name: string; kind: 'WEAPON' | 'CRITICAL' | string };
        }>;
    }>;
};

export default async function Page({ params }: { params: Promise<{ armyId: string }> }) {
    const { armyId } = await params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return <div className="p-4 text-red-300">Unauthorized.</div>;
    const userMeta = userId
        ? await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, role: true, photoEtag: true },
        })
        : null;
    const userName = userMeta?.name ?? session?.user?.name ?? 'Commander';
    const userRole = (userMeta?.role ?? session?.user?.role ?? 'USER') as 'USER' | 'ADMIN';

    const army = await prisma.army.findUnique(({
        where: { id: armyId },
        include: {
            faction: {
                select: {
                    id: true,
                    name: true,
                    limits: {
                        select: { tag: true, tier1: true, tier2: true, tier3: true },
                        orderBy: { tag: 'asc' },
                    },
                },
            },
            playedOpponents: {
                where: { boxesChecked: { gt: 0 } },
                orderBy: { updatedAt: 'desc' },
                include: {
                    opponentArmy: {
                        select: {
                            factionId: true,
                            faction: { select: { name: true } },
                        },
                    },
                },
            },
            units: {
                include: {
                    unit: {
                        include: {
                            startPerks: { include: { perk: { select: { id: true, name: true, description: true } } } },
                        },
                    },
                    upgrades: true,
                    weapons: true,
                    selectedOption: true,
                    capturedByArmy: {
                        select: {
                            id: true,
                            name: true,
                            faction: { select: { name: true } },
                        },
                    },
                    chosenPerks: {
                        select: {
                            valueInt: true,
                            perk: {
                                select: { id: true, name: true, description: true, behavior: true },
                            },
                        },
                        orderBy: { perkId: 'asc' },
                    },
                },
                orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
            },
        },
    }) as unknown as Parameters<typeof prisma.army.findUnique>[0]) as unknown as ArmyPageData | null;

    if (!army || army.deleted) return <div className="p-4 text-red-300">Army not found.</div>;

    const isOwner = army.ownerId === userId;
    const hasSharedAccess = isOwner
        ? true
        : Boolean(
            await prisma.armyShare.findFirst({
                where: { armyId, userId },
                select: { id: true },
            }),
        );

    if (!hasSharedAccess) {
        return <div className="p-4 text-red-300">You do not have access to this army.</div>;
    }
    const readOnly = !isOwner;
    const crewFactionName = army.faction.name;

    const effectiveTrainingFactionId = resolveEffectiveTrainingFactionId({
        ownFactionId: army.factionId,
        ownFactionName: army.faction.name,
        playedOpponents: army.playedOpponents.map((row) => ({
            boxesChecked: row.boxesChecked,
            updatedAt: row.updatedAt,
            opponentFactionId: row.opponentArmy.factionId,
            opponentFactionName: row.opponentArmy.faction.name,
        })),
    });

    const explicitTrainingFactionIds = Array.from(
        new Set(
            army.units
                .flatMap((u) => u.upgrades.map((up) => up.trainingFactionId ?? null))
                .filter((id): id is string => Boolean(id)),
        ),
    );
    const allTrainingFactionIds = Array.from(
        new Set([effectiveTrainingFactionId, ...explicitTrainingFactionIds]),
    );

    const rules = await p.factionUpgradeRule.findMany({
        where: { factionId: { in: allTrainingFactionIds } },
        select: { factionId: true, statKey: true, ratingPerPoint: true, ratingPerPointChampion: true },
    }) as Array<{
        factionId: string;
        statKey: string;
        ratingPerPoint: number;
        ratingPerPointChampion?: number | null;
    }>;
    const trainingRuleLookupByFaction = new Map<string, TrainingRuleLookup>();
    for (const factionId of allTrainingFactionIds) {
        const rows = rules.filter((rule) => rule.factionId === factionId);
        trainingRuleLookupByFaction.set(factionId, buildTrainingRuleLookup(rows));
    }
    const defaultTrainingRuleLookup = trainingRuleLookupByFaction.get(effectiveTrainingFactionId) ?? new Map();

    const allTemplateIds = Array.from(new Set(army.units.flatMap((u) => u.weapons.map((w) => w.templateId))));
    const templates =
        allTemplateIds.length > 0
            ? await prisma.weaponTemplate.findMany(({
                where: { id: { in: allTemplateIds } },
                include: {
                    baseEffects: { include: { effect: true } },
                    profiles: { include: { effects: { include: { effect: true } } }, orderBy: { order: 'asc' } },
                },
            }) as unknown as Parameters<typeof prisma.weaponTemplate.findMany>[0]) as unknown as WeaponTemplateRow[]
            : ([] as WeaponTemplateRow[]);
    const weaponById = new Map<string, WeaponTemplateRow>(templates.map((t) => [t.id, t]));

    const unitsArr = army.units;
    type UnitRow = ArmyUnitRow;

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
        const unitPerkNames = [
            ...u.unit.startPerks.map((sp) => sp.perk.name),
            ...u.chosenPerks.map((cp) => cp.perk.name),
        ];
        const companionPerkBonus = u.chosenPerks.reduce((sum, cp) => {
            const behavior = cp.perk.behavior ?? 'NONE';
            if (behavior !== 'COMPANION_ROBOT' && behavior !== 'COMPANION_BEAST') return sum;
            const bonus = cp.valueInt ?? 0;
            return sum + (bonus > 0 ? bonus : 0);
        }, 0);

        // Only positive stat upgrades count toward rating.
        const statsDelta = u.upgrades.reduce((acc, up) => {
            if (up.delta <= 0) return acc; // ignoruj rany
            const rulesLookup = up.trainingFactionId
                ? trainingRuleLookupByFaction.get(up.trainingFactionId) ?? defaultTrainingRuleLookup
                : defaultTrainingRuleLookup;
            const per = getUpgradeRatingPerPointForUnit({
                statKey: up.statKey,
                roleTag: u.unit.roleTag,
                unitPerkNames,
                crewFactionName,
                rulesLookup,
            });
            return acc + up.delta * per;
        }, 0);

        return baseFromTemplate + optionRating + weaponDelta + statsDelta + companionPerkBonus;
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
        const bonusPositive: BonusMap = { HP: 0, S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
        const bonusNegative: BonusMap = { HP: 0, S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
        for (const up of u.upgrades) {
            if (up.statKey === 'hp') {
                bonus.HP += up.delta;
                if (up.delta > 0) bonusPositive.HP += up.delta;
                else if (up.delta < 0) bonusNegative.HP += Math.abs(up.delta);
            } else if (isBonusKey(up.statKey)) {
                bonus[up.statKey] += up.delta;
                if (up.delta > 0) bonusPositive[up.statKey] += up.delta;
                else if (up.delta < 0) bonusNegative[up.statKey] += Math.abs(up.delta);
            }
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
                    valueText: (be as unknown as { valueText?: string | null }).valueText ?? null,
                    effectMode: 'ADD' as const,
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
                        valueText: (e as unknown as { valueText?: string | null }).valueText ?? null,
                        effectMode: (e as unknown as { effectMode?: 'ADD' | 'REMOVE' }).effectMode ?? 'ADD',
                    })),
                    parts: ('parts' in p ? (p as unknown as { parts: number | null }).parts : null) ?? null,
                    rating: ('ratingDelta' in p ? (p as unknown as { ratingDelta: number | null }).ratingDelta : null) ?? null,
                })) ?? [];

            return {
                name: t?.name ?? `#${w.templateId.slice(0, 6)}`,
                selectedProfileIds,
                baseType: t?.baseType ?? '-',
                baseTest: t?.baseTest ?? '-',
                baseEffects,
                profiles,
            };
        });

        const perkMap = new Map<string, { id: string; name: string; description: string }>();
        for (const sp of u.unit.startPerks) {
            perkMap.set(sp.perk.id, {
                id: sp.perk.id,
                name: sp.perk.name,
                description: sp.perk.description ?? '',
            });
        }
        for (const cp of u.chosenPerks) {
            perkMap.set(cp.perk.id, {
                id: cp.perk.id,
                name: cp.perk.name,
                description: cp.perk.description ?? '',
            });
        }
        const perks = [...perkMap.values()];

        return {
            id: u.id,
            templateName: u.unit.name,
            roleTag: u.unit.roleTag,
            isLeader: (u.unit as unknown as { isLeader?: boolean }).isLeader ?? false,
            temporaryLeader: (u as unknown as { temporaryLeader?: boolean }).temporaryLeader ?? false,
            temporary: (u as unknown as { temporary?: boolean }).temporary ?? false,
            base,
            bonus,
            bonusPositive,
            bonusNegative,
            wounds: u.wounds,
            present: u.present,
            upgradesCount: u.upgrades.length,
            perkNames: perks.map((p) => p.name),
            startPerkNames: u.unit.startPerks.map((sp) => sp.perk.name),
            perks,
            photoPath: u.photoPath ?? null,
            hasPhoto: Boolean((u as unknown as { photoEtag?: string | null }).photoEtag || u.photoPath),
            rating: unitRating(u),
            companionOwnerId: (u as unknown as { companionOwnerId?: string | null }).companionOwnerId ?? null,
            capturedByArmy: u.capturedByArmy
                ? {
                    id: u.capturedByArmy.id,
                    name: u.capturedByArmy.name,
                    factionName: u.capturedByArmy.faction.name,
                }
                : null,
            capturedAt: (u as unknown as { capturedAt?: Date | null }).capturedAt?.toISOString() ?? null,
            weapons,
        };
    });

    return (
        <ArmyPageClient
            backHref="/"
            userName={userName}
            userRole={userRole}
            userPhotoEtag={userMeta?.photoEtag ?? null}
            readOnly={readOnly}
            armyId={army.id}
            armyName={army.name}
            tier={army.tier}
            factionId={army.faction.id}
            factionName={army.faction.name}
            factionLimits={army.faction.limits.map((l) => ({
                tag: l.tag,
                tier1: l.tier1 ?? null,
                tier2: l.tier2 ?? null,
                tier3: l.tier3 ?? null,
            }))}
            resources={{ caps: army.caps, parts: army.parts, scout: army.scout, reach: army.reach, exp: army.exp, ploys: army.ploys }}
            units={uiUnits}
            rating={uiUnits.reduce((acc, u) => acc + (u.present ? u.rating : 0), 0)}
            subfactionId={(army as unknown as { subfactionId?: string | null }).subfactionId ?? null}
        />
    );
}
