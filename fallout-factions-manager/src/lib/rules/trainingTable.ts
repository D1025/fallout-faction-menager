type UpgradeStatKey = 'hp' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L';

export type TrainingRule = {
    statKey: string;
    ratingPerPoint: number;
    ratingPerPointChampion?: number | null;
};

export type TrainingRuleLookup = Map<
    UpgradeStatKey,
    {
        grunt: number;
        champion: number;
    }
>;

export type PlayedOpponentForTraining = {
    boxesChecked: number;
    updatedAt: Date | string;
    opponentFactionId: string;
    opponentFactionName: string;
};

const DEFAULT_CHAMPION_BY_STAT: Record<UpgradeStatKey, number> = {
    hp: 20,
    S: 10,
    P: 10,
    E: 15,
    C: 8,
    I: 8,
    A: 10,
    L: 15,
};

function normalizeText(input: string | null | undefined): string {
    return (input ?? '')
        .replace(/[’`]/g, "'")
        .toUpperCase()
        .trim();
}

export function normalizeUpgradeStatKey(statKey: string | null | undefined): UpgradeStatKey | null {
    const key = (statKey ?? '').trim();
    if (!key) return null;
    if (key === 'hp' || key === 'HP') return 'hp';
    if (key === 'S' || key === 'P' || key === 'E' || key === 'C' || key === 'I' || key === 'A' || key === 'L') return key;
    return null;
}

export function isChampionRole(roleTag: string | null | undefined): boolean {
    return normalizeText(roleTag) === 'CHAMPION';
}

export function isAutomatronsFactionName(name: string | null | undefined): boolean {
    return normalizeText(name).includes('AUTOMATRON');
}

export function isZetansFactionName(name: string | null | undefined): boolean {
    return normalizeText(name).includes('ZETAN');
}

export function hasAllTheToysPerk(perkNames: string[]): boolean {
    return perkNames.some((p) => normalizeText(p).includes('ALL THE TOYS'));
}

export function getDefaultChampionRatingForStat(statKey: UpgradeStatKey): number {
    return DEFAULT_CHAMPION_BY_STAT[statKey];
}

export function buildTrainingRuleLookup(rules: TrainingRule[]): TrainingRuleLookup {
    const lookup: TrainingRuleLookup = new Map();
    for (const r of rules) {
        const key = normalizeUpgradeStatKey(r.statKey);
        if (!key) continue;
        const grunt = Number.isFinite(r.ratingPerPoint) ? r.ratingPerPoint : 0;
        const championRaw = r.ratingPerPointChampion;
        const champion =
            championRaw != null && Number.isFinite(championRaw)
                ? championRaw
                : getDefaultChampionRatingForStat(key);
        lookup.set(key, { grunt, champion });
    }
    return lookup;
}

export function getUpgradeRatingPerPointForUnit(args: {
    statKey: string;
    roleTag: string | null;
    unitPerkNames: string[];
    crewFactionName: string;
    rulesLookup: TrainingRuleLookup;
}): number {
    const key = normalizeUpgradeStatKey(args.statKey);
    if (!key) return 0;
    const entry = args.rulesLookup.get(key);
    if (!entry) return 0;

    // Automatrons without "All the Toys" use a champion-only training table.
    if (isAutomatronsFactionName(args.crewFactionName) && !hasAllTheToysPerk(args.unitPerkNames)) {
        return entry.champion;
    }

    return isChampionRole(args.roleTag) ? entry.champion : entry.grunt;
}

export function resolveEffectiveTrainingFactionId(args: {
    ownFactionId: string;
    ownFactionName: string;
    playedOpponents: PlayedOpponentForTraining[];
}): string {
    if (!isZetansFactionName(args.ownFactionName)) return args.ownFactionId;

    const sorted = [...args.playedOpponents].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const lastNonZetan = sorted.find(
        (row) => row.boxesChecked > 0 && !isZetansFactionName(row.opponentFactionName),
    );
    return lastNonZetan?.opponentFactionId ?? args.ownFactionId;
}
