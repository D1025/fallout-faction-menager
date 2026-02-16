import { prisma } from '@/server/prisma';

type EffectKind = 'WEAPON' | 'CRITICAL';

type SnapshotEffect = {
    effectId: string;
    name: string;
    kind: EffectKind;
    description: string;
    valueInt: number | null;
    valueText: string | null;
    effectMode?: 'ADD' | 'REMOVE';
};

type SnapshotProfile = {
    id: string;
    typeOverride: string | null;
    testOverride: string | null;
    effects: SnapshotEffect[];
};

type SnapshotRuleDisplay = {
    label: string;
    description: string;
};

type SnapshotUpgradeStatKey = 'HP' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L';

export type PublicArmySnapshot = {
    sharedToken: string;
    army: {
        id: string;
        name: string;
        tier: number;
        faction: { id: string; name: string };
        subfactionName: string | null;
        resources: { caps: number; parts: number; scout: number; reach: number; exp: number; ploys: number };
        rating: number;
        limits: { tag: string; tier1: number | null; tier2: number | null; tier3: number | null }[];
        homeTurf: {
            hazard: { name: string; description: string } | null;
            legacyHazard: string;
            facilities: { name: string; description: string }[];
            legacyFacilities: string[];
        };
    };
    units: Array<{
        id: string;
        name: string;
        roleTag: string | null;
        isLeader: boolean;
        temporaryLeader: boolean;
        present: boolean;
        wounds: number;
        rating: number;
        special: {
            HP: number;
            S: number;
            P: number;
            E: number;
            C: number;
            I: number;
            A: number;
            L: number;
        };
        weapons: Array<{
            name: string;
            type: string;
            test: string;
            traits: SnapshotRuleDisplay[];
            criticals: SnapshotRuleDisplay[];
        }>;
        perks: Array<{
            id: string;
            name: string;
            description: string;
        }>;
        upgrades: Array<{
            statKey: SnapshotUpgradeStatKey;
            delta: number;
        }>;
    }>;
};

function formatEffectName(name: string, valueInt: number | null, valueText: string | null): string {
    if (valueInt != null) return `${name} (${valueInt})`;
    const vt = (valueText ?? '').trim();
    if (vt) return `${name} (${vt})`;
    return name;
}

function effectKey(e: { effectId?: string; name: string; kind: EffectKind }): string {
    return e.effectId ?? `${e.kind}:${e.name}`;
}

function toSnapshotUpgradeStatKey(statKey: string): SnapshotUpgradeStatKey | null {
    if (statKey === 'hp' || statKey === 'HP') return 'HP';
    if (statKey === 'S' || statKey === 'P' || statKey === 'E' || statKey === 'C' || statKey === 'I' || statKey === 'A' || statKey === 'L') {
        return statKey;
    }
    return null;
}

function computeWeaponDisplay(input: {
    baseType: string;
    baseTest: string;
    baseEffects: SnapshotEffect[];
    profiles: SnapshotProfile[];
    selectedProfileIds: string[];
}) {
    const selected = input.selectedProfileIds;
    const reversed = [...selected].reverse();

    const typeOverId = reversed.find((id) => {
        const p = input.profiles.find((x) => x.id === id);
        return Boolean(p?.typeOverride);
    });
    const testOverId = reversed.find((id) => {
        const p = input.profiles.find((x) => x.id === id);
        return Boolean(p?.testOverride);
    });

    const typeProfile = typeOverId ? input.profiles.find((x) => x.id === typeOverId) ?? null : null;
    const testProfile = testOverId ? input.profiles.find((x) => x.id === testOverId) ?? null : null;

    const type = typeProfile?.typeOverride?.trim() || input.baseType || '-';
    const test = testProfile?.testOverride?.trim() || input.baseTest || '-';

    const aggregate = new Map<string, SnapshotEffect>();
    for (const e of input.baseEffects) {
        aggregate.set(effectKey(e), { ...e, effectMode: 'ADD' });
    }
    for (const profileId of selected) {
        const profile = input.profiles.find((p) => p.id === profileId);
        if (!profile) continue;
        for (const e of profile.effects) {
            const key = effectKey(e);
            if ((e.effectMode ?? 'ADD') === 'REMOVE') aggregate.delete(key);
            else aggregate.set(key, { ...e, effectMode: 'ADD' });
        }
    }

    const allEffects = [...aggregate.values()];
    const traits = allEffects
        .filter((e) => e.kind === 'WEAPON')
        .map((e) => ({
            label: formatEffectName(e.name, e.valueInt, e.valueText),
            description: e.description?.trim() || 'No description.',
        }));
    const criticals = allEffects
        .filter((e) => e.kind === 'CRITICAL')
        .map((e) => ({
            label: formatEffectName(e.name, e.valueInt, e.valueText),
            description: e.description?.trim() || 'No description.',
        }));

    return { type, test, traits, criticals };
}

async function buildSnapshotByArmyId(armyId: string, shareToken: string): Promise<PublicArmySnapshot | null> {
    const army = await prisma.army.findUnique({
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
            subfaction: { select: { name: true } },
            HomeTurf: {
                include: {
                    hazardDef: { select: { name: true, description: true } },
                    facilities: {
                        select: {
                            name: true,
                            facilityDef: { select: { name: true, description: true } },
                        },
                    },
                },
            },
            units: {
                include: {
                    unit: {
                        select: {
                            id: true,
                            name: true,
                            roleTag: true,
                            isLeader: true,
                            hp: true,
                            s: true,
                            p: true,
                            e: true,
                            c: true,
                            i: true,
                            a: true,
                            l: true,
                            baseRating: true,
                            startPerks: {
                                select: {
                                    perk: {
                                        select: { id: true, name: true, description: true },
                                    },
                                },
                            },
                        },
                    },
                    chosenPerks: {
                        select: {
                            perk: {
                                select: { id: true, name: true, description: true },
                            },
                        },
                        orderBy: { perkId: 'asc' },
                    },
                    upgrades: true,
                    weapons: true,
                    selectedOption: { select: { rating: true } },
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    if (!army) return null;

    const rules = await prisma.factionUpgradeRule.findMany({
        where: { factionId: army.factionId },
        select: { statKey: true, ratingPerPoint: true },
    });
    const ruleByKey = new Map<string, number>(rules.map((r) => [r.statKey, r.ratingPerPoint]));

    const templateIds = Array.from(new Set(army.units.flatMap((u) => u.weapons.map((w) => w.templateId))));
    const templates =
        templateIds.length > 0
            ? await prisma.weaponTemplate.findMany({
                where: { id: { in: templateIds } },
                include: {
                    baseEffects: {
                        include: { effect: { select: { id: true, name: true, kind: true, description: true } } },
                    },
                    profiles: {
                        include: {
                            effects: {
                                include: { effect: { select: { id: true, name: true, kind: true, description: true } } },
                            },
                        },
                        orderBy: { order: 'asc' },
                    },
                },
            })
            : [];
    const templateById = new Map(templates.map((t) => [t.id, t]));
    const armyUnits = army.units;
    type ArmyUnitRow = (typeof armyUnits)[number];

    function unitRating(unit: ArmyUnitRow): number {
        const baseFromTemplate = unit.unit.baseRating ?? 0;
        const optionRating = unit.selectedOption?.rating ?? 0;

        const weaponDelta = unit.weapons.reduce((sum, w) => {
            const t = templateById.get(w.templateId);
            if (!t) return sum;
            const selected = new Set(
                w.activeMods.filter((m) => m.startsWith('__profile:')).map((m) => m.slice(10)),
            );
            const delta = t.profiles.reduce(
                (acc, p) => (selected.has(p.id) ? acc + (p.ratingDelta ?? 0) : acc),
                0,
            );
            return sum + delta;
        }, 0);

        const statsDelta = unit.upgrades.reduce((acc, up) => {
            if (up.delta <= 0) return acc;
            const key = up.statKey === 'hp' ? 'hp' : up.statKey;
            return acc + up.delta * (ruleByKey.get(key) ?? 0);
        }, 0);

        return baseFromTemplate + optionRating + weaponDelta + statsDelta;
    }

    const units = armyUnits.map((u) => {
        const bonus = { HP: 0, S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
        for (const up of u.upgrades) {
            if (up.statKey === 'hp') bonus.HP += up.delta;
            else if (up.statKey === 'S') bonus.S += up.delta;
            else if (up.statKey === 'P') bonus.P += up.delta;
            else if (up.statKey === 'E') bonus.E += up.delta;
            else if (up.statKey === 'C') bonus.C += up.delta;
            else if (up.statKey === 'I') bonus.I += up.delta;
            else if (up.statKey === 'A') bonus.A += up.delta;
            else if (up.statKey === 'L') bonus.L += up.delta;
        }

        const weapons = u.weapons.map((wi) => {
            const t = templateById.get(wi.templateId);
            if (!t) {
                return {
                    name: `#${wi.templateId.slice(0, 6)}`,
                    type: '-',
                    test: '-',
                    traits: [],
                    criticals: [],
                };
            }

            const selectedProfileIds = wi.activeMods
                .filter((m) => m.startsWith('__profile:'))
                .map((m) => m.slice(10));

            const baseEffects: SnapshotEffect[] = t.baseEffects.map((be) => ({
                effectId: be.effect.id,
                name: be.effect.name,
                kind: be.effect.kind as EffectKind,
                description: be.effect.description ?? '',
                valueInt: be.valueInt,
                valueText: be.valueText ?? null,
                effectMode: 'ADD',
            }));
            const profiles: SnapshotProfile[] = t.profiles.map((p) => ({
                id: p.id,
                typeOverride: p.typeOverride ?? null,
                testOverride: p.testOverride ?? null,
                effects: p.effects.map((e) => ({
                    effectId: e.effect.id,
                    name: e.effect.name,
                    kind: e.effect.kind as EffectKind,
                    description: e.effect.description ?? '',
                    valueInt: e.valueInt,
                    valueText: e.valueText ?? null,
                    effectMode: e.effectMode ?? 'ADD',
                })),
            }));

            const display = computeWeaponDisplay({
                baseType: t.baseType,
                baseTest: t.baseTest,
                baseEffects,
                profiles,
                selectedProfileIds,
            });

            return {
                name: t.name,
                type: display.type,
                test: display.test,
                traits: display.traits,
                criticals: display.criticals,
            };
        });

        const perkMap = new Map<string, { id: string; name: string; description: string }>();
        for (const p of u.unit.startPerks) {
            perkMap.set(p.perk.id, {
                id: p.perk.id,
                name: p.perk.name,
                description: p.perk.description ?? '',
            });
        }
        for (const p of u.chosenPerks) {
            perkMap.set(p.perk.id, {
                id: p.perk.id,
                name: p.perk.name,
                description: p.perk.description ?? '',
            });
        }
        const perks = Array.from(perkMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'en'));

        const upgrades = u.upgrades
            .map((up) => {
                const key = toSnapshotUpgradeStatKey(up.statKey);
                if (!key || up.delta === 0) return null;
                return { statKey: key, delta: up.delta };
            })
            .filter((it): it is { statKey: SnapshotUpgradeStatKey; delta: number } => Boolean(it));

        return {
            id: u.id,
            name: u.unit.name,
            roleTag: u.unit.roleTag,
            isLeader: Boolean(u.unit.isLeader),
            temporaryLeader: Boolean(u.temporaryLeader),
            present: u.present,
            wounds: u.wounds,
            rating: unitRating(u),
            special: {
                HP: u.unit.hp + bonus.HP,
                S: u.unit.s + bonus.S,
                P: u.unit.p + bonus.P,
                E: u.unit.e + bonus.E,
                C: u.unit.c + bonus.C,
                I: u.unit.i + bonus.I,
                A: u.unit.a + bonus.A,
                L: u.unit.l + bonus.L,
            },
            weapons,
            perks,
            upgrades,
        };
    });

    const rating = units.reduce((sum, u) => sum + u.rating, 0);
    const homeTurf = army.HomeTurf;
    const facilities = (homeTurf?.facilities ?? [])
        .filter((f) => Boolean(f.facilityDef))
        .map((f) => ({
            name: f.facilityDef?.name ?? f.name,
            description: f.facilityDef?.description ?? '',
        }));
    const legacyFacilities = (homeTurf?.facilities ?? [])
        .filter((f) => !f.facilityDef)
        .map((f) => f.name);

    return {
        sharedToken: shareToken,
        army: {
            id: army.id,
            name: army.name,
            tier: army.tier,
            faction: { id: army.faction.id, name: army.faction.name },
            subfactionName: army.subfaction?.name ?? null,
            resources: {
                caps: army.caps,
                parts: army.parts,
                scout: army.scout,
                reach: army.reach,
                exp: army.exp,
                ploys: army.ploys,
            },
            rating,
            limits: army.faction.limits.map((l) => ({
                tag: l.tag,
                tier1: l.tier1 ?? null,
                tier2: l.tier2 ?? null,
                tier3: l.tier3 ?? null,
            })),
            homeTurf: {
                hazard: homeTurf?.hazardDef
                    ? { name: homeTurf.hazardDef.name, description: homeTurf.hazardDef.description }
                    : null,
                legacyHazard: homeTurf?.hazard ?? '',
                facilities,
                legacyFacilities,
            },
        },
        units,
    };
}

export async function getPublicArmySnapshotByToken(params: {
    token: string;
    viewerUserId?: string | null;
}): Promise<PublicArmySnapshot | null> {
    const share = await prisma.armyPublicShare.findUnique({
        where: { token: params.token },
        select: { token: true, enabled: true, armyId: true, army: { select: { ownerId: true } } },
    });
    if (!share || !share.enabled) return null;

    const viewerUserId = params.viewerUserId ?? null;
    if (viewerUserId && viewerUserId !== share.army.ownerId) {
        await prisma.armyShare.upsert({
            where: { armyId_userId: { armyId: share.armyId, userId: viewerUserId } },
            create: { armyId: share.armyId, userId: viewerUserId, perm: 'READ' },
            update: {},
        });
    }

    return buildSnapshotByArmyId(share.armyId, share.token);
}
