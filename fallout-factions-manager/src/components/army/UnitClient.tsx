// src/components/army/UnitClient.tsx
'use client';

import { CheckOutlined, CloseOutlined, PlusOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { PhotoCropperModal } from '@/components/images/PhotoCropperModal';
import { useRouter } from 'next/navigation';
import { EffectTooltip, usePreloadEffects } from '@/components/effects/EffectTooltip';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_MB, SUPPORTED_IMAGE_UPLOAD_MIME_TYPES } from '@/lib/images/uploadConfig';

type EffectKind = 'WEAPON' | 'CRITICAL';
type StatKey = 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L' | 'hp';
type UiStatKey = 'HP' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L';
type SpecialStatKey = Exclude<UiStatKey, 'HP'>;

type WeaponProfileUI = {
    id: string;
    type: string | null;
    test: string | null;
    parts: number | null;
    rating: number | null; // delta
    effects: { id: string; effectId?: string; name: string; valueInt: number | null; valueText?: string | null; kind: EffectKind; effectMode?: 'ADD' | 'REMOVE' }[];
};

type WeaponUI = {
    id: string; // WeaponInstance.id
    name: string;
    selectedProfileIds: string[]; // multi
    baseType: string;
    baseTest: string;
    baseEffects: { id: string; effectId?: string; name: string; valueInt: number | null; valueText?: string | null; kind: EffectKind; effectMode?: 'ADD' | 'REMOVE' }[];
    profiles: WeaponProfileUI[];
};

type UpgradeUI = {
    id: string;
    statKey: StatKey;
    delta: number;
    trainingArmyId?: string | null;
    trainingFactionId?: string | null;
    at: string;
};
type Perk = {
    id: string;
    name: string;
    requiresValue: boolean;
    statKey: SpecialStatKey | null;
    minValue: number | null;
    isInnate: boolean;
    category: 'REGULAR' | 'AUTOMATRON';
    description?: string;
};

type CaptureTarget = {
    armyId: string;
    armyName: string;
    factionName: string;
    owner: { id: string; name: string; photoEtag: string | null };
};

type CaptureStatus = {
    capturedByArmyId: string | null;
    capturedAt: string | null;
};

type ZetanTrainingOption = {
    armyId: string;
    armyName: string;
    factionId: string;
    factionName: string;
};

type UnitTemplateTag = 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS';

function normalizeRoleTag(tag: string | null | undefined): UnitTemplateTag | null {
    const t = (tag ?? '').toUpperCase().trim();
    if (t === 'CHAMPION' || t === 'GRUNT' || t === 'COMPANION' || t === 'LEGENDS') return t as UnitTemplateTag;
    return null;
}

const SPECIAL_ORDER: SpecialStatKey[] = ['S', 'P', 'E', 'C', 'I', 'A', 'L'];
type WeaponTestHint = { weaponIndex: 0 | 1; stat: SpecialStatKey };

const WEAPON_TEST_ACCENTS = [
    {
        textClass: 'text-sky-100',
        textBgClass: 'bg-sky-500/18',
        cellClass: 'bg-sky-500/12',
    },
    {
        textClass: 'text-amber-100',
        textBgClass: 'bg-amber-500/18',
        cellClass: 'bg-amber-500/12',
    },
] as const;

function parseTestSpecialStat(test: string | null | undefined): SpecialStatKey | null {
    const normalized = (test ?? '').toUpperCase();
    for (const ch of normalized) {
        if ((SPECIAL_ORDER as readonly string[]).includes(ch)) return ch as SpecialStatKey;
    }
    return null;
}

function getWeaponAccent(index: number) {
    return WEAPON_TEST_ACCENTS[index] ?? WEAPON_TEST_ACCENTS[0];
}

function TagChip({ tag }: { tag: UnitTemplateTag | null }) {
    if (!tag) return null;

    const label = tag === 'CHAMPION' ? 'Champion' : tag === 'GRUNT' ? 'Grunt' : tag === 'COMPANION' ? 'Companion' : 'Legends';

    const cls =
        tag === 'CHAMPION'
            ? 'bg-amber-500/10 text-amber-200'
            : tag === 'COMPANION'
                ? 'bg-sky-500/10 text-sky-200'
                : tag === 'LEGENDS'
                    ? 'bg-purple-500/10 text-purple-200'
                    : 'bg-zinc-900 text-zinc-200';

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
    );
}

export function UnitClient({
    unitId,
    armyId,
    name,
    roleTag,
    isLeader,
    temporaryLeader,
    special,
    upgrades,
    weapons,
    photoPath,
    hasPhoto,
    startPerkNames,
    ownedPerks,
    captureTargets,
    captureStatus,
    canManageCapture = false,
    isZetansArmy = false,
    zetanTrainingOptions = [],
}: {
    unitId: string;
    armyId: string;
    name: string;
    roleTag: string | null;
    isLeader?: boolean;
    temporaryLeader?: boolean;
    present: boolean;
    wounds: number;
    special: Record<UiStatKey, number>;
    upgrades: UpgradeUI[];
    weapons: WeaponUI[];
    photoPath?: string | null;
    hasPhoto?: boolean;
    startPerkNames?: string[];
    ownedPerks?: Array<{ id: string; name: string; description: string; isInnate: boolean; statKey?: SpecialStatKey | null; minValue?: number | null }>;
    captureTargets?: CaptureTarget[];
    captureStatus?: CaptureStatus;
    canManageCapture?: boolean;
    isZetansArmy?: boolean;
    zetanTrainingOptions?: ZetanTrainingOption[];
}) {
    const router = useRouter();
    const armyDirtyStorageKey = `ffm:army:dirty:${armyId}`;
    const [tmpLeader, setTmpLeader] = useState(Boolean(temporaryLeader));

    useEffect(() => {
        setTmpLeader(Boolean(temporaryLeader));
    }, [temporaryLeader]);

    async function saveTemporaryLeader(next: boolean) {
        const prev = tmpLeader;
        setTmpLeader(next);
        const res = await fetch(`/api/units/${unitId}/temporary-leader`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ temporaryLeader: next }),
        }).catch(() => null);
        if (!res || !res.ok) {
            setTmpLeader(prev);
            notifyApiError('Failed to save Crew Leader.');
            return;
        }
        router.refresh();
    }

    async function saveCapture(nextCapturedByArmyId: string | null): Promise<boolean> {
        if (!canManageCapture) return false;
        const prev = captureState;
        setSavingCapture(true);
        try {
            const res = await fetch(`/api/units/${unitId}/capture`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ capturedByArmyId: nextCapturedByArmyId }),
            });
            if (!res.ok) {
                notifyApiError(await res.text().catch(() => 'Failed to save captive state'));
                setCaptureState(prev);
                return false;
            }
            const payload = (await res.json().catch(() => null)) as { capturedByArmyId?: string | null; capturedAt?: string | null } | null;
            const nextState: CaptureStatus = {
                capturedByArmyId: payload?.capturedByArmyId ?? nextCapturedByArmyId,
                capturedAt: payload?.capturedAt ?? (nextCapturedByArmyId ? new Date().toISOString() : null),
            };
            setCaptureState(nextState);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(armyDirtyStorageKey, String(Date.now()));
            }
            router.refresh();
            return true;
        } catch {
            setCaptureState(prev);
            notifyApiError('Failed to save captive state');
            return false;
        } finally {
            setSavingCapture(false);
        }
    }

    async function clearCapture() {
        await saveCapture(null);
    }

    // cache-busting: after photo updates, the browser may keep an old image from cache
    const [photoBuster, setPhotoBuster] = useState<number>(0);
    const [hasPhotoState, setHasPhotoState] = useState(Boolean(hasPhoto));
    useEffect(() => {
        setPhotoBuster(Date.now());
    }, [photoPath]);
    useEffect(() => {
        setHasPhotoState(Boolean(hasPhoto));
    }, [hasPhoto]);

    const photoSrcBase = `/api/units/${unitId}/photo/file`;
    const photoSrc = hasPhotoState ? `${photoSrcBase}?v=${photoBuster}` : null;
    const [photoMissing, setPhotoMissing] = useState(false);
    const [activeUpgrades, setActiveUpgrades] = useState<UpgradeUI[]>(upgrades);
    const [captureState, setCaptureState] = useState<CaptureStatus>({
        capturedByArmyId: captureStatus?.capturedByArmyId ?? null,
        capturedAt: captureStatus?.capturedAt ?? null,
    });
    const [savingCapture, setSavingCapture] = useState(false);
    const [capturePickerOpen, setCapturePickerOpen] = useState(false);
    const [captureSearch, setCaptureSearch] = useState('');
    useEffect(() => {
        setPhotoMissing(false);
    }, [photoBuster, unitId, hasPhotoState]);
    useEffect(() => {
        setActiveUpgrades(upgrades);
    }, [upgrades]);
    useEffect(() => {
        setCaptureState({
            capturedByArmyId: captureStatus?.capturedByArmyId ?? null,
            capturedAt: captureStatus?.capturedAt ?? null,
        });
    }, [captureStatus?.capturedAt, captureStatus?.capturedByArmyId]);
    useEffect(() => {
        if (capturePickerOpen) return;
        setCaptureSearch('');
    }, [capturePickerOpen]);

    useEffect(() => {
        if (hasPhotoState) return;

        const ctrl = new AbortController();
        void fetch(`/api/units/${unitId}/photo`, {
            method: 'GET',
            cache: 'no-store',
            signal: ctrl.signal,
        })
            .then(async (res) => {
                if (!res.ok) return;
                const payload = (await res.json().catch(() => null)) as { hasPhoto?: boolean } | null;
                if (!payload?.hasPhoto) return;
                setHasPhotoState(true);
                setPhotoMissing(false);
                setPhotoBuster(Date.now());
            })
            .catch(() => {
                // noop
            });

        return () => ctrl.abort();
    }, [unitId, hasPhotoState]);

    // ===== Combined upgrade bonuses (including negative wounds) =====
    const bonus = useMemo(() => {
        const b: Record<UiStatKey, number> = { HP: 0, S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
        for (const u of activeUpgrades) {
            if (u.statKey === 'hp') b.HP += u.delta;
            else b[u.statKey as Exclude<StatKey, 'hp'>] += u.delta;
        }
        return b;
    }, [activeUpgrades]);

    const bonusPositive = useMemo(() => {
        const b: Record<UiStatKey, number> = { HP: 0, S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
        for (const u of activeUpgrades) {
            if (u.delta <= 0) continue;
            if (u.statKey === 'hp') b.HP += u.delta;
            else b[u.statKey as Exclude<StatKey, 'hp'>] += u.delta;
        }
        return b;
    }, [activeUpgrades]);

    const bonusNegative = useMemo(() => {
        const b: Record<UiStatKey, number> = { HP: 0, S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
        for (const u of activeUpgrades) {
            if (u.delta >= 0) continue;
            if (u.statKey === 'hp') b.HP += Math.abs(u.delta);
            else b[u.statKey as Exclude<StatKey, 'hp'>] += Math.abs(u.delta);
        }
        return b;
    }, [activeUpgrades]);

    const finalStats = useMemo(
        () => ({
            HP: special.HP + bonus.HP,
            S: special.S + bonus.S,
            P: special.P + bonus.P,
            E: special.E + bonus.E,
            C: special.C + bonus.C,
            I: special.I + bonus.I,
            A: special.A + bonus.A,
            L: special.L + bonus.L,
        }),
        [special, bonus]
    );

    const weaponTestHints = useMemo<WeaponTestHint[]>(
        () =>
            weapons.slice(0, 2).flatMap((w, idx) => {
                const rev = [...w.selectedProfileIds].reverse();
                const testOverId = rev.find((id) => {
                    const p = w.profiles.find((pp) => pp.id === id);
                    return Boolean(p && p.test != null);
                });
                const testOver = testOverId ? w.profiles.find((pp) => pp.id === testOverId) ?? null : null;
                const effectiveTest = testOver?.test ?? w.baseTest;
                const stat = parseTestSpecialStat(effectiveTest);
                return stat ? [{ weaponIndex: idx as 0 | 1, stat }] : [];
            }),
        [weapons],
    );

    const hasAllTheToys = useMemo(() => {
        const names = (startPerkNames ?? []).map((n) => n.trim().toUpperCase());
        return names.includes('ALL THE TOYS');
    }, [startPerkNames]);

    // ===== Perks (addable list) =====
    const [perks, setPerks] = useState<Perk[]>([]);
    const [perkPickerOpen, setPerkPickerOpen] = useState(false);
    const [perkSearch, setPerkSearch] = useState('');
    const [perkCategory, setPerkCategory] = useState<'ALL' | SpecialStatKey>('ALL');
    const [perkSort, setPerkSort] = useState<'CATEGORY' | 'NAME' | 'REQ_ASC' | 'REQ_DESC'>('CATEGORY');
    const [perkOnlyMeetingReq, setPerkOnlyMeetingReq] = useState(false);
    const [addingPerkId, setAddingPerkId] = useState<string | null>(null);
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/perks', { cache: 'no-store' });
                if (res.ok) setPerks(await res.json());
            } catch {
                // noop
            }
        })();
    }, []);

    const ownedSet = useMemo(() => new Set((ownedPerks ?? []).map((p) => p.id)), [ownedPerks]);

    const specialPerks = useMemo(() => {
        return perks
            .filter((p) => {
                const isSpecialLinked = Boolean(p.statKey && p.minValue != null);
                if (!isSpecialLinked) return false;
                if (hasAllTheToys) return p.category === 'AUTOMATRON';
                return p.category !== 'AUTOMATRON';
            })
            .filter((p) => !ownedSet.has(p.id))
            .map((p) => {
                const statKey = p.statKey as SpecialStatKey;
                const minValue = p.minValue as number;
                const currentValue = finalStats[statKey] ?? 0;
                return {
                    ...p,
                    statKey,
                    minValue,
                    currentValue,
                    meetsRequirement: currentValue >= minValue,
                };
            });
    }, [perks, finalStats, hasAllTheToys, ownedSet]);

    const filteredPerks = useMemo(() => {
        let list = specialPerks;
        if (perkCategory !== 'ALL') {
            list = list.filter((p) => p.statKey === perkCategory);
        }
        if (perkOnlyMeetingReq) {
            list = list.filter((p) => p.meetsRequirement);
        }
        const q = perkSearch.trim().toLowerCase();
        if (q) {
            list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q));
        }
        const out = [...list];
        out.sort((a, b) => {
            if (perkSort === 'NAME') return a.name.localeCompare(b.name, 'pl');
            if (perkSort === 'REQ_ASC') {
                if (a.minValue !== b.minValue) return a.minValue - b.minValue;
                return a.name.localeCompare(b.name, 'pl');
            }
            if (perkSort === 'REQ_DESC') {
                if (a.minValue !== b.minValue) return b.minValue - a.minValue;
                return a.name.localeCompare(b.name, 'pl');
            }
            const aRank = SPECIAL_ORDER.indexOf(a.statKey);
            const bRank = SPECIAL_ORDER.indexOf(b.statKey);
            if (aRank !== bRank) return aRank - bRank;
            if (a.minValue !== b.minValue) return a.minValue - b.minValue;
            return a.name.localeCompare(b.name, 'pl');
        });
        return out;
    }, [specialPerks, perkCategory, perkOnlyMeetingReq, perkSearch, perkSort]);

    // ===== Akcje =====
    async function setProfiles(weaponInstanceId: string, profileIds: string[]) {
        const res = await fetch(`/api/weapons/${weaponInstanceId}/profiles`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileIds }),
        });
        if (!res.ok) {
            notifyApiError('Failed to change profiles');
            return false;
        }
        return true;
    }

    const [upStat, setUpStat] = useState<StatKey>('S');
    const [upDelta, setUpDelta] = useState<number>(1);
    const [upTrainingArmyId, setUpTrainingArmyId] = useState<string>('');
    const [addingUpgrade, setAddingUpgrade] = useState(false);
    const [revertingUpgradeId, setRevertingUpgradeId] = useState<string | null>(null);
    const requiresTrainingSource = isZetansArmy && upDelta > 0 && zetanTrainingOptions.length > 0;
    const zetanTrainingOptionByArmyId = useMemo(() => {
        const map = new Map<string, ZetanTrainingOption>();
        for (const row of zetanTrainingOptions) map.set(row.armyId, row);
        return map;
    }, [zetanTrainingOptions]);

    useEffect(() => {
        if (!isZetansArmy || zetanTrainingOptions.length === 0) {
            setUpTrainingArmyId('');
            return;
        }
        setUpTrainingArmyId((prev) =>
            prev && zetanTrainingOptions.some((row) => row.armyId === prev)
                ? prev
                : zetanTrainingOptions[0].armyId,
        );
    }, [isZetansArmy, zetanTrainingOptions]);

    async function addUpgrade() {
        if (upDelta === 0) {
            notifyWarning('Delta cannot be 0.');
            return;
        }
        if (requiresTrainingSource && !upTrainingArmyId) {
            notifyWarning('Select training source army for Zetans upgrade.');
            return;
        }
        setAddingUpgrade(true);
        try {
            const body: { statKey: StatKey; delta: number; trainingArmyId?: string } = {
                statKey: upStat,
                delta: upDelta,
            };
            if (requiresTrainingSource) body.trainingArmyId = upTrainingArmyId;
            const res = await fetch(`/api/units/${unitId}/upgrades`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body), // can be negative
            });
            if (!res.ok) {
                notifyApiError('Failed to add ulepszenia');
                return;
            }
            const payload = (await res.json().catch(() => null)) as
                | {
                    id?: string;
                    statKey?: StatKey;
                    delta?: number;
                    trainingArmyId?: string | null;
                    trainingFactionId?: string | null;
                    at?: string;
                }
                | null;
            if (!payload?.id) {
                notifyApiError('Saved, but failed to read new upgrade data.');
                return;
            }
            const createdId = payload.id;
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(armyDirtyStorageKey, String(Date.now()));
            }
            setActiveUpgrades((prev) => [
                ...prev,
                {
                    id: createdId,
                    statKey: payload.statKey ?? upStat,
                    delta: Number.isFinite(payload.delta) ? Number(payload.delta) : upDelta,
                    trainingArmyId: payload.trainingArmyId ?? null,
                    trainingFactionId: payload.trainingFactionId ?? null,
                    at: payload.at ?? new Date().toISOString(),
                },
            ]);
        } finally {
            setAddingUpgrade(false);
        }
    }

    async function deleteUpgrade(upgradeId: string) {
        setRevertingUpgradeId(upgradeId);
        try {
            const res = await fetch(`/api/units/${unitId}/upgrades/${upgradeId}`, { method: 'DELETE' });
            if (!res.ok) {
                notifyApiError('Failed to revert ulepszenia');
                return;
            }
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(armyDirtyStorageKey, String(Date.now()));
            }
            setActiveUpgrades((prev) => prev.filter((u) => u.id !== upgradeId));
        } finally {
            setRevertingUpgradeId(null);
        }
    }

    async function addPerk(nextPerkId: string) {
        if (!nextPerkId) return;
        const selected = specialPerks.find((p) => p.id === nextPerkId);
        if (!selected) {
            notifyWarning('Selected perk not found.');
            return;
        }
        if (!selected.meetsRequirement) {
            notifyWarning(`Requirement not met: ${selected.statKey} ${selected.minValue} (you have ${selected.currentValue}).`);
            return;
        }
        if (selected.requiresValue) {
            notifyWarning('This perk requires a value - currently unsupported for chosenPerkIds.');
            return;
        }

        setAddingPerkId(nextPerkId);
        try {
            const res = await fetch(`/api/units/${unitId}/perks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ perkId: nextPerkId }),
            });
            if (!res.ok) {
                notifyApiError('Failed to add perk');
                return;
            }
            setPerkPickerOpen(false);
            location.reload();
        } finally {
            setAddingPerkId(null);
        }
    }

    async function removePerk(removeId: string) {
        const res = await fetch(`/api/units/${unitId}/perks`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ perkId: removeId }),
        });
        if (!res.ok) {
            const t = await res.text().catch(() => '');
            notifyApiError(t || 'Failed to delete perk');
            return;
        }
        location.reload();
    }

    /* ===== Compact SPECIAL with correct +/- ===== */
    function renderSpecialCompact() {
        const HEAD = ['S', 'P', 'E', 'C', 'I', 'A', 'L', 'HP'] as const;
        return (
            <div className="overflow-hidden">
                <div className="grid grid-cols-8 bg-teal-700/70 text-teal-50 text-[11px] font-semibold tracking-widest">
                    {HEAD.map((h) => (
                        <div key={h} className="px-2 py-1 text-center">
                            {h}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-8 bg-zinc-950 text-sm text-zinc-100">
                    {HEAD.map((h) => {
                        const base = h === 'HP' ? special.HP : special[h as SpecialStatKey];
                        const fin = h === 'HP' ? finalStats.HP : finalStats[h as SpecialStatKey];
                        const delta = fin - base;
                        const plus = h === 'HP' ? bonusPositive.HP : bonusPositive[h as SpecialStatKey];
                        const minus = h === 'HP' ? bonusNegative.HP : bonusNegative[h as SpecialStatKey];
                        const hasW1 = h !== 'HP' && weaponTestHints.some((hint) => hint.weaponIndex === 0 && hint.stat === h);
                        const hasW2 = h !== 'HP' && weaponTestHints.some((hint) => hint.weaponIndex === 1 && hint.stat === h);
                        const accentClass = hasW1 && hasW2
                            ? 'bg-violet-500/12'
                            : hasW1
                                ? WEAPON_TEST_ACCENTS[0].cellClass
                                : hasW2
                                    ? WEAPON_TEST_ACCENTS[1].cellClass
                                    : '';
                        return (
                            <div key={h} className={'relative px-2 py-1 text-center tabular-nums ' + accentClass}>
                                <div className={delta !== 0 ? (delta > 0 ? 'text-emerald-300 font-semibold' : 'text-red-300 font-semibold') : ''}>
                                    {fin}
                                </div>
                                {plus > 0 ? (
                                    <span className="absolute right-0.5 top-0.5 text-[10px] leading-none text-emerald-400">+{plus}</span>
                                ) : null}
                                {minus > 0 ? (
                                    <span className="absolute right-0.5 bottom-0.5 text-[10px] leading-none text-red-400">-{minus}</span>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    /* ===== effect helper: X -> valueInt ===== */
    function formatEffect(name: string, valueInt: number | null, valueText?: string | null): string {
        let out = name;
        if (valueInt != null) {
            let replaced = out.replace(/\(\s*X\s*\)/g, String(valueInt));
            replaced = replaced.replace(/\bX\b/g, String(valueInt));
            out = replaced !== out ? replaced : `${out} (${valueInt})`;
        }
        if (valueText && valueText.trim()) {
            out += ` [${valueText.trim()}]`;
        }
        return out;
    }

    function EffectSpan({
        name,
        valueInt,
        valueText,
        effectId,
    }: {
        name: string;
        valueInt: number | null;
        valueText?: string | null;
        effectId?: string;
    }) {
        const label = formatEffect(name, valueInt, valueText);
        if (effectId) {
            return (
                <EffectTooltip
                    effectId={effectId}
                    label={label}
                    className="cursor-help underline decoration-dotted underline-offset-2"
                />
            );
        }
        return <span>{label}</span>;
    }

    /* ===== Weapon card ===== */
    function WeaponCard({ w, weaponIndex }: { w: WeaponUI; weaponIndex: number }) {
        const [selected, setSelected] = useState<string[]>(w.selectedProfileIds);
        const accent = getWeaponAccent(weaponIndex);

        type EffectRef = { name: string; valueInt: number | null; valueText?: string | null; effectId?: string; effectMode?: 'ADD' | 'REMOVE' };

        // preload efektow na start
        const preloadIds = useMemo(() => {
            const ids: string[] = [];
            for (const e of w.baseEffects) if (e.effectId) ids.push(e.effectId);
            for (const p of w.profiles) for (const e of p.effects) if (e.effectId) ids.push(e.effectId);
            return ids;
        }, [w.baseEffects, w.profiles]);
        usePreloadEffects(preloadIds);

        async function toggle(id: string, checked: boolean) {
            const next = checked ? [...new Set([...selected, id])] : selected.filter((x) => x !== id);
            setSelected(next);
            const ok = await setProfiles(w.id, next);
            if (!ok) setSelected(selected);
            else location.reload();
        }

        const baseTraits: EffectRef[] = w.baseEffects
            .filter((e) => e.kind === 'WEAPON')
            .map((e) => ({ name: e.name, valueInt: e.valueInt, valueText: e.valueText ?? null, effectId: e.effectId, effectMode: 'ADD' }));
        const baseCrits: EffectRef[] = w.baseEffects
            .filter((e) => e.kind === 'CRITICAL')
            .map((e) => ({ name: e.name, valueInt: e.valueInt, valueText: e.valueText ?? null, effectId: e.effectId, effectMode: 'ADD' }));

        type Row = {
            kind: 'BASE' | 'PROFILE';
            key: string;
            type: string | null;
            test: string | null;
            traits: EffectRef[];
            crits: EffectRef[];
            parts: number | null;
            rating: number | null;
            profileId?: string;
        };

        const rows: Row[] = [];
        rows.push({
            kind: 'BASE',
            key: 'BASE',
            type: w.baseType || '-',
            test: w.baseTest || '-',
            traits: baseTraits,
            crits: baseCrits,
            parts: null,
            rating: null,
        });

        for (const p of w.profiles) {
            const traits: EffectRef[] = p.effects
                .filter((e) => e.kind === 'WEAPON')
                .map((e) => ({ name: e.name, valueInt: e.valueInt, valueText: e.valueText ?? null, effectId: e.effectId, effectMode: e.effectMode ?? 'ADD' }));
            const crits: EffectRef[] = p.effects
                .filter((e) => e.kind === 'CRITICAL')
                .map((e) => ({ name: e.name, valueInt: e.valueInt, valueText: e.valueText ?? null, effectId: e.effectId, effectMode: e.effectMode ?? 'ADD' }));
            rows.push({
                kind: 'PROFILE',
                key: p.id,
                profileId: p.id,
                type: p.type,
                test: p.test,
                traits,
                crits,
                parts: p.parts,
                rating: p.rating,
            });
        }

        function splitTypeAndRange(raw: string | null | undefined): { type: string; range: string } {
            const text = (raw ?? '').trim();
            if (!text) return { type: '-', range: '-' };

            const rangeMatch = text.match(/\(([^)]*)\)/);
            const range = rangeMatch?.[1]?.trim() ?? '-';

            const type = text
                .replace(/\([^)]*\)/g, '')
                .replace(/\s*-\s*$/g, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

            return { type: type || '-', range };
        }

        const typeLabels = rows.map((r) => splitTypeAndRange(r.type).type).filter((t) => t !== '-');
        const uniqTypes = [...new Set(typeLabels)];
        const weaponTypeLabel = uniqTypes.length === 0 ? '-' : uniqTypes.length === 1 ? uniqTypes[0] : `${uniqTypes[0]}+`;
        const isMeleeWeapon = typeLabels.some((t) => t.toLowerCase().includes('melee'));

        const renderEffects = (arr: EffectRef[]) => {
            if (!arr.length) return <span>-</span>;
            return (
                <div className="space-y-0.5">
                    {arr.map((item, idx) => (
                        <div
                            key={`${item.effectId ?? item.name}_${idx}`}
                            className={'whitespace-normal break-all ' + ((item.effectMode ?? 'ADD') === 'REMOVE' ? 'text-red-300' : '')}
                        >
                            <EffectSpan
                                name={(item.effectMode ?? 'ADD') === 'REMOVE' ? `- ${item.name}` : item.name}
                                valueInt={item.valueInt}
                                valueText={item.valueText}
                                effectId={item.effectId}
                            />
                        </div>
                    ))}
                </div>
            );
        };

        return (
            <div>
                <div className="mb-1 flex items-center gap-2">
                    <div className="font-medium">{w.name}</div>
                    <div className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">{weaponTypeLabel}</div>
                </div>
                <div className="mt-1 overflow-hidden">
                    <div className="max-w-full overflow-x-hidden">
                        <table className="w-full table-fixed text-[10px] leading-tight sm:text-xs">
                            <thead>
                                <tr className="bg-teal-700/70 text-[11px] font-semibold uppercase tracking-wide text-teal-50">
                                    {!isMeleeWeapon ? <th className="w-[10%] px-1 py-1 text-left">Z</th> : null}
                                    <th className={(isMeleeWeapon ? 'w-[14%]' : 'w-[12%]') + ' px-1 py-1 text-left'}>Test</th>
                                    <th className={(isMeleeWeapon ? 'w-[29%]' : 'w-[27%]') + ' px-1 py-1 text-left'}>Traits</th>
                                    <th className={(isMeleeWeapon ? 'w-[29%]' : 'w-[26%]') + ' px-1 py-1 text-left'}>
                                        <span className="sm:hidden">Crit</span>
                                        <span className="hidden sm:inline">Critical Effect</span>
                                    </th>
                                    <th className={(isMeleeWeapon ? 'w-[8%]' : 'w-[8%]') + ' px-1 py-1 text-center'}>P</th>
                                    <th className={(isMeleeWeapon ? 'w-[8%]' : 'w-[8%]') + ' px-1 py-1 text-center'}>R</th>
                                    <th className={(isMeleeWeapon ? 'w-[10%]' : 'w-[9%]') + ' px-0.5 py-1 text-center'}>U</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => {
                                    const isSel = r.kind === 'PROFILE' && r.profileId ? selected.includes(r.profileId) : false;
                                    const { range } = splitTypeAndRange(r.type);
                                    const testStat = parseTestSpecialStat(r.test);
                                    return (
                                        <tr key={r.key} className="align-top border-b border-zinc-800/70">
                                            {!isMeleeWeapon ? <td className="px-1 py-1 whitespace-normal break-all text-zinc-100">{range}</td> : null}
                                            <td
                                                className={
                                                    'px-1 py-1 whitespace-normal break-all ' +
                                                    (testStat ? accent.textBgClass + ' ' + accent.textClass : 'text-zinc-100')
                                                }
                                            >
                                                {r.test ?? '-'}
                                            </td>
                                            <td className="px-1 py-1 whitespace-normal break-all text-zinc-300">{renderEffects(r.traits)}</td>
                                            <td className="px-1 py-1 whitespace-normal break-all text-zinc-300">{renderEffects(r.crits)}</td>
                                            <td className="px-1 py-1 text-center tabular-nums">{r.parts != null ? r.parts : '-'}</td>
                                            <td className="px-1 py-1 text-center tabular-nums">{r.rating != null ? r.rating : '-'}</td>
                                            <td className="px-0.5 py-1 text-center align-middle">
                                                {(() => {
                                                    if (r.kind !== 'PROFILE' || !r.profileId) {
                                                        return (
                                                            <span className="inline-flex h-6 w-6 items-center justify-center text-zinc-500">
                                                                -
                                                            </span>
                                                        );
                                                    }
                                                    const profileId = r.profileId;
                                                    return (
                                                        <button
                                                            onClick={() => void toggle(profileId, !isSel)}
                                                            className={
                                                                'inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold leading-none ' +
                                                                (isSel
                                                                    ? 'bg-emerald-700/40 text-emerald-100'
                                                                    : 'bg-emerald-500 text-emerald-950')
                                                            }
                                                            title={isSel ? 'Revert upgrade' : 'Apply upgrade'}
                                                            aria-label={isSel ? 'Revert upgrade' : 'Apply upgrade'}
                                                        >
                                                            {isSel ? (
                                                                <CheckOutlined className="text-[10px] leading-none" />
                                                            ) : (
                                                                <PlusOutlined className="text-[10px] leading-none" />
                                                            )}
                                                        </button>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }
    const [pick, setPick] = useState<File | null>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    async function uploadPhoto(blob: Blob) {
        setUploadingPhoto(true);
        try {
            const f = new File([blob], 'unit.jpg', { type: blob.type || 'image/jpeg' });
            const form = new FormData();
            form.set('file', f);

            const res = await fetch(`/api/units/${unitId}/photo`, {
                method: 'POST',
                body: form,
            });
            if (!res.ok) {
                const t = await res.text().catch(() => '');
                throw new Error(t || 'Upload failed');
            }
            setHasPhotoState(true);
            setPhotoMissing(false);
            setPhotoBuster(Date.now());
        } finally {
            setUploadingPhoto(false);
            setPick(null);
        }
    }

    async function deletePhoto() {
        confirmAction({
            title: 'Delete this unit photo?',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onOk: async () => {
                setUploadingPhoto(true);
                try {
                    const res = await fetch(`/api/units/${unitId}/photo`, { method: 'DELETE' });
                    if (!res.ok) throw new Error(await res.text());
                    setHasPhotoState(false);
                    setPhotoMissing(false);
                    setPhotoBuster(Date.now());
                } catch {
                    notifyApiError('Failed to delete unit photo.');
                    throw new Error('delete photo failed');
                } finally {
                    setUploadingPhoto(false);
                }
            },
        });
    }

    const normalizedTag = useMemo(() => normalizeRoleTag(roleTag), [roleTag]);
    const positiveUpgrades = useMemo(() => activeUpgrades.filter((u) => u.delta >= 0), [activeUpgrades]);
    const woundUpgrades = useMemo(() => activeUpgrades.filter((u) => u.delta < 0), [activeUpgrades]);
    const captureTargetById = useMemo(() => {
        const map = new Map<string, CaptureTarget>();
        for (const t of captureTargets ?? []) map.set(t.armyId, t);
        return map;
    }, [captureTargets]);
    const activeCaptureTarget = captureState.capturedByArmyId ? captureTargetById.get(captureState.capturedByArmyId) ?? null : null;
    const filteredCaptureTargets = useMemo(() => {
        const query = captureSearch.trim().toLowerCase();
        const items = captureTargets ?? [];
        if (!query) return items;
        return items.filter((t) => {
            const haystack = `${t.armyName} ${t.factionName} ${t.owner.name}`.toLowerCase();
            return haystack.includes(query);
        });
    }, [captureTargets, captureSearch]);

    return (
        <div className="space-y-4">
            <section className="pb-2">
                <div className="flex items-start gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-zinc-950">
                        {hasPhotoState && !photoMissing ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={photoSrc ?? undefined}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                onError={() => {
                                    setPhotoMissing(true);
                                    setHasPhotoState(false);
                                }}
                            />
                        ) : (
                            <div className="grid h-full w-full place-items-center text-zinc-500">
                                <div className="flex flex-col items-center gap-1">
                                    <UserOutlined className="text-base" />
                                    <span className="text-[10px]">No photo</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold truncate">{name}</div>
                            <TagChip tag={normalizedTag} />
                            {isLeader ? (
                                <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
                                    LEADER
                                </span>
                            ) : null}
                            {tmpLeader ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                                    CREW LEADER
                                </span>
                            ) : null}
                            {captureState.capturedByArmyId ? (
                                <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                                    CAPTURED
                                </span>
                            ) : null}
                        </div>

                        <div className="mt-2">
                            <label className="flex items-center gap-2 text-xs text-zinc-200">
                                <input type="checkbox" checked={tmpLeader} onChange={(e) => void saveTemporaryLeader(e.target.checked)} />
                                <span>Crew Leader</span>
                            </label>
                        </div>

                        <div className="mt-1 text-[11px] text-zinc-400">This photo is assigned to this unit instance in the army.</div>

                        <div className="mt-2 flex flex-wrap gap-2">
                            <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-3 text-xs font-medium text-zinc-200">
                                {uploadingPhoto ? 'Uploading...' : hasPhotoState && !photoMissing ? 'Change photo' : 'Take / add photo'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    disabled={uploadingPhoto}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        e.currentTarget.value = '';
                                        if (!file) return;

                                        // input validation (before opening crop modal)
                                        const allowed = new Set<string>(SUPPORTED_IMAGE_UPLOAD_MIME_TYPES);
                                        if (!allowed.has(file.type)) {
                                             notifyWarning('Supported formats: JPG/PNG/WebP');
                                            return;
                                        }
                                        if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
                                            notifyWarning(`File too large. Select a photo up to ${MAX_IMAGE_UPLOAD_MB}MB.`);
                                            return;
                                        }

                                        setPick(file);
                                    }}
                                />
                            </label>

                            {hasPhotoState && !photoMissing && (
                                <button
                                    type="button"
                                    onClick={() => void deletePhoto()}
                                    disabled={uploadingPhoto}
                                    className="h-9 rounded-xl bg-red-900/30 px-3 text-xs font-medium text-red-200 disabled:opacity-50"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* SPECIAL */}
            <section className="mt-2">
                <div className="text-sm font-medium">SPECIAL</div>
                <div className="mt-2">{renderSpecialCompact()}</div>
            </section>

            {/* Weapon */}
            <section className="mt-4">
                <div className="text-sm font-medium">Weapon</div>
                <div className="mt-2 grid gap-3">
                    {weapons.map((w, idx) => (
                        <WeaponCard key={w.id} w={w} weaponIndex={idx} />
                    ))}
                    {weapons.length === 0 && <div className="text-zinc-500">No weapons</div>}
                </div>
            </section>

            {/* Upgrades (+ Wounds) */}
            <section className="mt-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Upgrades</div>
                    <div className="text-[11px] text-zinc-500">
                        Positive: {positiveUpgrades.length} | Wounds: {woundUpgrades.length}
                    </div>
                </div>

                <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-2">
                        <select
                            value={upStat}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUpStat(e.target.value as StatKey)}
                            className="h-10 rounded-xl bg-zinc-900 px-3 text-base"
                        >
                            {(['S', 'P', 'E', 'C', 'I', 'A', 'L', 'hp'] as StatKey[]).map((k) => (
                                <option key={k} value={k}>
                                    {k.toUpperCase()}
                                </option>
                            ))}
                        </select>
                        <input
                            inputMode="numeric"
                            value={upDelta}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setUpDelta(Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0)
                            }
                            className="h-10 rounded-xl bg-zinc-900 px-3 text-right text-xl font-semibold tabular-nums"
                            placeholder="0"
                        />
                    </div>

                    <div className="mt-2 grid grid-cols-6 gap-1.5">
                        {[-3, -2, -1, +1, +2, +3].map((d) => (
                            <button
                                key={d}
                                onClick={() => setUpDelta(d)}
                                className={
                                    'h-9 rounded-lg text-sm font-semibold ' +
                                    (d < 0 ? 'bg-red-900/20 text-red-300' : 'bg-emerald-900/20 text-emerald-300')
                                }
                                title={d < 0 ? 'Wound (negative modifier)' : 'Upgrade (positive)'}
                            >
                                {d > 0 ? `+${d}` : d}
                            </button>
                        ))}
                    </div>

                    {isZetansArmy && upDelta > 0 && (
                        <div className="mt-2 space-y-1">
                            <div className="text-[11px] font-medium text-zinc-300">Training source army</div>
                            <select
                                value={upTrainingArmyId}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUpTrainingArmyId(e.target.value)}
                                disabled={zetanTrainingOptions.length === 0}
                                className="h-10 w-full rounded-xl bg-zinc-900 px-3 text-sm disabled:opacity-60"
                            >
                                {zetanTrainingOptions.length === 0 ? (
                                    <option value="">No played non-Zetan armies</option>
                                ) : (
                                    zetanTrainingOptions.map((row) => (
                                        <option key={row.armyId} value={row.armyId}>
                                            {row.armyName} | {row.factionName}
                                        </option>
                                    ))
                                )}
                            </select>
                            <div className="text-[11px] text-zinc-500">
                                Each positive Zetan upgrade uses the selected army&apos;s training table.
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => void addUpgrade()}
                        disabled={addingUpgrade || upDelta === 0 || (requiresTrainingSource && !upTrainingArmyId)}
                        className="ff-cta ff-cta-primary mt-2 h-10 w-full text-base"
                    >
                        {addingUpgrade ? 'Adding...' : 'Add Upgrade / Wound'}
                    </button>

                    <div className="mt-2 text-[11px] text-zinc-500">
                        Negative modifiers (wounds) <span className="font-medium text-red-400">are not counted toward rating</span>.
                    </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-zinc-300">
                    {positiveUpgrades.map((u) => (
                        <div key={u.id} className="grid grid-cols-[minmax(0,1fr)_92px] items-center gap-2 border-b border-zinc-800/70 px-0 py-2">
                            <div className="min-w-0">
                                <div className="truncate">
                                    <span className="font-medium">{u.statKey.toUpperCase()}</span>{' '}
                                    {u.delta > 0 ? `+${u.delta}` : u.delta}
                                    <span className="text-zinc-500"> | {new Date(u.at).toLocaleString()}</span>
                                </div>
                                {isZetansArmy && u.trainingArmyId ? (
                                    <div className="truncate text-[11px] text-zinc-500">
                                        Source:{' '}
                                        {(() => {
                                            const row = zetanTrainingOptionByArmyId.get(u.trainingArmyId ?? '');
                                            if (!row) return 'selected army';
                                            return `${row.armyName} | ${row.factionName}`;
                                        })()}
                                    </div>
                                ) : null}
                            </div>
                            <button
                                onClick={() => void deleteUpgrade(u.id)}
                                disabled={revertingUpgradeId === u.id}
                                className="h-9 rounded-xl bg-zinc-800 px-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                                aria-label="Revert upgrade"
                                title="Revert"
                            >
                                {revertingUpgradeId === u.id ? '...' : 'Revert'}
                            </button>
                        </div>
                    ))}
                    {positiveUpgrades.length === 0 && <div className="text-zinc-500">No positive upgrades</div>}
                </div>

                <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-red-300">Wounds (negative)</div>
                        <div className="text-[11px] text-red-300/70">{woundUpgrades.length}</div>
                    </div>
                    <div className="grid gap-2 text-xs">
                        {woundUpgrades.map((u) => (
                            <div key={u.id} className="grid grid-cols-[minmax(0,1fr)_92px] items-center gap-2 border-b border-red-900/40 px-0 py-2 text-red-200">
                                <div className="min-w-0 truncate">
                                    <span className="font-semibold">{u.statKey.toUpperCase()}</span> {u.delta}
                                    <span className="ml-1 text-red-300/70">| {new Date(u.at).toLocaleString()}</span>
                                </div>
                                <button
                                    onClick={() => void deleteUpgrade(u.id)}
                                    disabled={revertingUpgradeId === u.id}
                                    className="h-9 rounded-xl bg-red-900/40 px-2 text-sm font-medium hover:bg-red-900/50 disabled:opacity-50"
                                    aria-label="Delete wound"
                                    title="Revert"
                                >
                                    {revertingUpgradeId === u.id ? '...' : 'Revert'}
                                </button>
                            </div>
                        ))}
                        {woundUpgrades.length === 0 && <div className="text-zinc-500">No wounds</div>}
                    </div>
                </div>
            </section>

            {/* Perks */}
            <section className="mt-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Perks</div>
                    <button
                        type="button"
                        onClick={() => setPerkPickerOpen(true)}
                        className="ff-cta ff-cta-primary"
                    >
                        Add Perks
                    </button>
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                    Owned: <span className="font-semibold text-zinc-300">{(ownedPerks ?? []).length}</span> | Available SPECIAL:{' '}
                    <span className="font-semibold text-zinc-300">{specialPerks.length}</span>
                </div>

                {/* Owned perks list */}
                <div className="mt-2 grid gap-2">
                    {(ownedPerks ?? []).map((p) => (
                        <div key={p.id} className="border-b border-zinc-800/70 py-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="font-medium">{p.name}</div>
                                </div>
                                {!p.isInnate || (p.statKey != null && p.minValue != null) ? (
                                    <button
                                        type="button"
                                        onClick={() => void removePerk(p.id)}
                                        className="shrink-0 rounded-lg bg-red-900/20 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-900/30"
                                        title="Delete perk"
                                    >
                                        Delete
                                    </button>
                                ) : (
                                    <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                                        INNATE
                                    </span>
                                )}
                            </div>
                            <div className="mt-1 text-sm text-zinc-300 whitespace-pre-wrap">{p.description || '-'}</div>
                        </div>
                    ))}
                    {(ownedPerks ?? []).length === 0 && <div className="text-sm text-zinc-500">No perks.</div>}
                </div>
            </section>

            {/* Captured (rare action at bottom) */}
            <section className="mt-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Captured</div>
                    {captureState.capturedByArmyId ? (
                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                            ACTIVE
                        </span>
                    ) : (
                        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">
                            NOT CAPTURED
                        </span>
                    )}
                </div>

                <div className="mt-2 space-y-2">
                    <div className="text-xs text-zinc-300">
                        {captureState.capturedByArmyId
                            ? activeCaptureTarget
                                ? `${activeCaptureTarget.armyName} (${activeCaptureTarget.factionName}) | ${activeCaptureTarget.owner.name}`
                                : 'Captured army selected'
                            : 'Unit is currently not captured'}
                    </div>
                    {captureState.capturedAt ? (
                        <div className="mt-1 text-[11px] text-zinc-500">
                            Captured at: {new Date(captureState.capturedAt).toLocaleString()}
                        </div>
                    ) : null}

                    {canManageCapture ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setCapturePickerOpen(true)}
                                disabled={savingCapture || (captureTargets ?? []).length === 0}
                                className="h-9 rounded-xl bg-emerald-500 px-3 text-xs font-semibold text-emerald-950 disabled:opacity-50"
                            >
                                {captureState.capturedByArmyId ? 'Change captor army' : 'Set captured army'}
                            </button>
                            {captureState.capturedByArmyId ? (
                                <button
                                    type="button"
                                    onClick={() => void clearCapture()}
                                    disabled={savingCapture}
                                    className="h-9 rounded-xl bg-red-900/25 px-3 text-xs font-semibold text-red-200 disabled:opacity-50"
                                >
                                    {savingCapture ? 'Saving...' : 'Cancel capture'}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </section>

            {perkPickerOpen && (
                <div className="fixed inset-0 z-30 overflow-x-hidden">
                    <button
                        aria-label="Close"
                        onClick={() => setPerkPickerOpen(false)}
                        className="absolute inset-0 bg-black/60"
                    />

                    <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[88dvh] w-full max-w-screen-sm flex-col overflow-x-hidden rounded-t-3xl bg-zinc-900 shadow-xl">
                        <div className="p-4 pb-3">
                            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-sm font-semibold">Add perk SPECIAL</div>
                                    <div className="mt-0.5 text-[11px] text-zinc-400">Search, filter and add perks with SPECIAL requirements.</div>
                                </div>
                                <button
                                    onClick={() => setPerkPickerOpen(false)}
                                    className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="mt-3">
                                <div className="flex items-center gap-2 rounded-2xl bg-zinc-950 px-3 py-2">
                                    <SearchOutlined className="text-zinc-400" />
                                    <input
                                        value={perkSearch}
                                        onChange={(e) => setPerkSearch(e.target.value)}
                                        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                                        placeholder="Search perk..."
                                    />
                                    {perkSearch && (
                                        <button
                                            onClick={() => setPerkSearch('')}
                                            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 active:scale-95"
                                            aria-label="Clear"
                                        >
                                            <CloseOutlined />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                                {(['ALL', ...SPECIAL_ORDER] as Array<'ALL' | SpecialStatKey>).map((k) => {
                                    const active = perkCategory === k;
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => setPerkCategory(k)}
                                            className={
                                                'rounded-full px-2.5 py-1 text-xs font-medium ' +
                                                (active
                                                    ? 'bg-emerald-500/10 text-emerald-300'
                                                    : 'bg-zinc-900 text-zinc-300')
                                            }
                                        >
                                            {k === 'ALL' ? 'All' : k}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <select
                                    value={perkSort}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                        setPerkSort(e.target.value as 'CATEGORY' | 'NAME' | 'REQ_ASC' | 'REQ_DESC')
                                    }
                                    className="vault-input px-2 py-1 text-xs"
                                >
                                    <option value="CATEGORY">Sort: SPECIAL category</option>
                                    <option value="REQ_ASC">Sort: requirement ascending</option>
                                    <option value="REQ_DESC">Sort: requirement descending</option>
                                    <option value="NAME">Sort: name A-Z</option>
                                </select>
                                <label className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
                                    <input
                                        type="checkbox"
                                        checked={perkOnlyMeetingReq}
                                        onChange={(e) => setPerkOnlyMeetingReq(e.target.checked)}
                                        className="h-3.5 w-3.5 accent-emerald-500"
                                    />
                                    Only perks meeting requirements
                                </label>
                                <div className="text-[11px] text-zinc-500">
                                    Results: <span className="font-semibold text-zinc-300">{filteredPerks.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="vault-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
                            <div className="grid gap-2">
                                {filteredPerks.map((p) => {
                                    const canAdd = p.meetsRequirement && !p.requiresValue && addingPerkId == null;
                                    return (
                                        <div key={p.id} className="rounded-xl bg-zinc-950 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="font-medium">{p.name}</div>
                                                    <div className="mt-1 text-[11px] text-zinc-400">
                                                        Requirement: {p.statKey} {p.minValue} | Current: {p.currentValue}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={!canAdd || addingPerkId === p.id}
                                                    onClick={() => void addPerk(p.id)}
                                                    className={
                                                        'ff-cta shrink-0 ' +
                                                        (canAdd
                                                            ? 'ff-cta-primary'
                                                            : 'ff-cta-neutral text-zinc-500')
                                                    }
                                                >
                                                    {addingPerkId === p.id ? 'Adding...' : 'Add'}
                                                </button>
                                            </div>
                                            <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{p.description || '-'}</div>
                                            {p.requiresValue ? (
                                                <div className="mt-2 text-xs text-amber-300">This perk requires valueInt (not supported yet).</div>
                                            ) : null}
                                            {!p.meetsRequirement ? (
                                                <div className="mt-2 text-xs text-red-300">SPECIAL requirement not met.</div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                                {filteredPerks.length === 0 ? <div className="rounded-xl bg-zinc-950 p-3 text-sm text-zinc-500">No perks for current filters.</div> : null}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {capturePickerOpen && (
                <div className="fixed inset-0 z-30 overflow-x-hidden">
                    <button
                        aria-label="Close"
                        onClick={() => setCapturePickerOpen(false)}
                        className="absolute inset-0 bg-black/60"
                    />

                    <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[72dvh] w-full max-w-screen-sm flex-col overflow-x-hidden rounded-t-3xl bg-zinc-900 shadow-xl">
                        <div className="p-4 pb-3">
                            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-sm font-semibold">Set captured army</div>
                                    <div className="mt-0.5 text-[11px] text-zinc-400">Select one army from your shared list.</div>
                                </div>
                                <button
                                    onClick={() => setCapturePickerOpen(false)}
                                    className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="mt-3">
                                <div className="flex items-center gap-2 rounded-2xl bg-zinc-950 px-3 py-2">
                                    <SearchOutlined className="text-zinc-400" />
                                    <input
                                        value={captureSearch}
                                        onChange={(e) => setCaptureSearch(e.target.value)}
                                        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                                        placeholder="Search army..."
                                    />
                                    {captureSearch && (
                                        <button
                                            onClick={() => setCaptureSearch('')}
                                            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 active:scale-95"
                                            aria-label="Clear"
                                        >
                                            <CloseOutlined />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="vault-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
                            <div className="grid gap-2">
                                {filteredCaptureTargets.map((t) => {
                                    const ownerPhotoSrc = t.owner.photoEtag
                                        ? `/api/users/${t.owner.id}/photo/file?v=${t.owner.photoEtag}`
                                        : null;
                                    return (
                                        <div key={t.armyId} className="rounded-xl bg-zinc-950 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex items-center gap-2">
                                                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-900">
                                                        {ownerPhotoSrc ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={ownerPhotoSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
                                                        ) : (
                                                            <div className="grid h-full w-full place-items-center text-[11px] font-semibold text-zinc-300">
                                                                {(t.owner.name[0] ?? '?').toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium">{t.armyName}</div>
                                                        <div className="truncate text-[11px] text-zinc-400">
                                                            {t.factionName} | from {t.owner.name}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        void (async () => {
                                                            const ok = await saveCapture(t.armyId);
                                                            if (ok) setCapturePickerOpen(false);
                                                        })();
                                                    }}
                                                    disabled={savingCapture}
                                                    className="shrink-0 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-emerald-950 disabled:opacity-50"
                                                >
                                                    {savingCapture ? 'Saving...' : 'Set'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredCaptureTargets.length === 0 ? (
                                    <div className="rounded-xl bg-zinc-950 p-3 text-sm text-zinc-500">No shared armies for current search.</div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {pick && (
                <PhotoCropperModal
                    file={pick}
                    targetSize={400}
                    maxBytes={MAX_IMAGE_UPLOAD_BYTES}
                    onCancel={() => setPick(null)}
                    onConfirm={(blob) => void uploadPhoto(blob)}
                />
            )}
        </div>
    );
}

// (intentionally no re-export alias here)


