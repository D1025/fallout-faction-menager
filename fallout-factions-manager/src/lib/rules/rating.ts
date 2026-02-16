import type { FactionUpgradeRule } from '@prisma/client';

export function ratingFromStatUpgrades(
    upgrades: { statKey: string; delta: number }[],
    rules: Pick<FactionUpgradeRule, 'statKey' | 'ratingPerPoint'>[],
): number {
    const map = new Map(rules.map((r) => [r.statKey.toUpperCase(), r.ratingPerPoint]));
    let sum = 0;
    for (const u of upgrades) {
        const per = map.get(u.statKey.toUpperCase()) ?? 0;
        sum += per * u.delta;
    }
    return sum;
}

export function ratingFromWeapons(weapons: { ratingBase: number; ratingDelta: number }[]): number {
    // if base weapon rating is computed elsewhere, include only deltas
    return weapons.reduce((s, w) => s + (w.ratingDelta ?? 0), 0);
}

export function unitTotalRating(opts: {
    baseFromUnitTemplate?: number | null;
    optionRating?: number | null;
    weapons: { ratingBase: number; ratingDelta: number }[];
    statUpgradesDelta: number;
}): number {
    const base = (opts.baseFromUnitTemplate ?? 0) + (opts.optionRating ?? 0);
    const weap = ratingFromWeapons(opts.weapons);
    return base + weap + opts.statUpgradesDelta;
}
