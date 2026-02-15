// src/components/army/UnitClient.tsx
'use client';

import { CheckOutlined, CloseOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { PhotoCropperModal } from '@/components/images/PhotoCropperModal';
import { useRouter } from 'next/navigation';
import { EffectTooltip, usePreloadEffects } from '@/components/effects/EffectTooltip';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';

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

type UpgradeUI = { id: string; statKey: StatKey; delta: number; at: string };
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

type UnitTemplateTag = 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS';

function normalizeRoleTag(tag: string | null | undefined): UnitTemplateTag | null {
    const t = (tag ?? '').toUpperCase().trim();
    if (t === 'CHAMPION' || t === 'GRUNT' || t === 'COMPANION' || t === 'LEGENDS') return t as UnitTemplateTag;
    return null;
}

const SPECIAL_ORDER: SpecialStatKey[] = ['S', 'P', 'E', 'C', 'I', 'A', 'L'];

function TagChip({ tag }: { tag: UnitTemplateTag | null }) {
    if (!tag) return null;

    const label = tag === 'CHAMPION' ? 'Champion' : tag === 'GRUNT' ? 'Grunt' : tag === 'COMPANION' ? 'Companion' : 'Legends';

    const cls =
        tag === 'CHAMPION'
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            : tag === 'COMPANION'
                ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                : tag === 'LEGENDS'
                    ? 'border-purple-500/40 bg-purple-500/10 text-purple-200'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-200';

    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
    );
}

export function UnitClient({
    unitId,
    name,
    roleTag,
    isLeader,
    temporaryLeader,
    special,
    upgrades,
    weapons,
    photoPath,
    startPerkNames,
    ownedPerks,
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
    startPerkNames?: string[];
    ownedPerks?: Array<{ id: string; name: string; description: string; isInnate: boolean; statKey?: SpecialStatKey | null; minValue?: number | null }>;
}) {
    const router = useRouter();
    const [tmpLeader, setTmpLeader] = useState(Boolean(temporaryLeader));

    useEffect(() => {
        setTmpLeader(Boolean(temporaryLeader));
    }, [temporaryLeader]);

    async function saveTemporaryLeader(next: boolean) {
        if (!isLeader) return;
        const prev = tmpLeader;
        setTmpLeader(next);
        const res = await fetch(`/api/units/${unitId}/temporary-leader`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ temporaryLeader: next }),
        }).catch(() => null);
        if (!res || !res.ok) {
            setTmpLeader(prev);
            notifyApiError('Nie udało się zapisać Temporary Leader.');
            return;
        }
        router.refresh();
    }

    // cache-busting: po zmianie zdjÄ™cia przeglÄ…darka potrafi trzymaÄ‡ stary obraz z cache
    const [photoBuster, setPhotoBuster] = useState<number>(0);
    useEffect(() => {
        setPhotoBuster(Date.now());
    }, [photoPath]);

    const photoSrcBase = `/api/units/${unitId}/photo/file`;
    const photoSrc = `${photoSrcBase}?v=${photoBuster}`;
    const [photoMissing, setPhotoMissing] = useState(false);
    useEffect(() => {
        setPhotoMissing(false);
    }, [photoBuster, unitId]);

    // ===== ĹÄ…czne bonusy z ulepszeĹ„ (w tym rany â€“ ujemne) =====
    const bonus = useMemo(() => {
        const b: Record<UiStatKey, number> = { HP: 0, S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
        for (const u of upgrades) {
            if (u.statKey === 'hp') b.HP += u.delta;
            else b[u.statKey as Exclude<StatKey, 'hp'>] += u.delta;
        }
        return b;
    }, [upgrades]);

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

    const hasAllTheToys = useMemo(() => {
        const names = (startPerkNames ?? []).map((n) => n.trim().toUpperCase());
        return names.includes('ALL THE TOYS');
    }, [startPerkNames]);

    // ===== Perki (lista do dodawania) =====
    const [perks, setPerks] = useState<Perk[]>([]);
    const [perkPickerOpen, setPerkPickerOpen] = useState(false);
    const [perkSearch, setPerkSearch] = useState('');
    const [perkCategory, setPerkCategory] = useState<'ALL' | SpecialStatKey>('ALL');
    const [perkSort, setPerkSort] = useState<'CATEGORY' | 'NAME' | 'REQ_ASC' | 'REQ_DESC'>('CATEGORY');
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
    }, [specialPerks, perkCategory, perkSearch, perkSort]);

    // ===== Akcje =====
    async function setProfiles(weaponInstanceId: string, profileIds: string[]) {
        const res = await fetch(`/api/weapons/${weaponInstanceId}/profiles`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileIds }),
        });
        if (!res.ok) {
            notifyApiError('Nie udało się zmienić profili');
            return false;
        }
        return true;
    }

    const [upStat, setUpStat] = useState<StatKey>('S');
    const [upDelta, setUpDelta] = useState<number>(1);

    async function addUpgrade() {
        const res = await fetch(`/api/units/${unitId}/upgrades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ statKey: upStat, delta: upDelta }), // moĹĽe byÄ‡ ujemny
        });
        if (!res.ok) {
            notifyApiError('Nie udało się dodać ulepszenia');
            return;
        }
        location.reload();
    }

    async function deleteUpgrade(upgradeId: string) {
        const res = await fetch(`/api/units/${unitId}/upgrades/${upgradeId}`, { method: 'DELETE' });
        if (!res.ok) {
            notifyApiError('Nie udało się cofnąć ulepszenia');
            return;
        }
        location.reload();
    }

    async function addPerk(nextPerkId: string) {
        if (!nextPerkId) return;
        const selected = specialPerks.find((p) => p.id === nextPerkId);
        if (!selected) {
            notifyWarning('Nie znaleziono wybranego perka.');
            return;
        }
        if (!selected.meetsRequirement) {
            notifyWarning(`Wymaganie niespelnione: ${selected.statKey} ${selected.minValue} (masz ${selected.currentValue}).`);
            return;
        }
        if (selected.requiresValue) {
            notifyWarning('Ten perk wymaga wartosci - na razie nieobslugiwane dla chosenPerkIds.');
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
                notifyApiError('Nie udalo sie dodac perka');
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
            notifyApiError(t || 'Nie udało się™ usunąć perka');
            return;
        }
        location.reload();
    }

    /* ===== SPECIAL kompakt z poprawnym +/â’ ===== */
    function renderSpecialCompact() {
        const HEAD = ['S', 'P', 'E', 'C', 'I', 'A', 'L', 'HP'] as const;
        const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
        return (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <div className="grid grid-cols-8 bg-teal-700/70 text-teal-50 text-[11px] font-semibold tracking-widest">
                    {HEAD.map((h) => (
                        <div key={h} className="px-2 py-1 text-center">
                            {h}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-8 bg-zinc-950 text-sm text-zinc-100">
                    {HEAD.map((h) => {
                        const base = h === 'HP' ? special.HP : special[h as Exclude<typeof h, 'HP'>];
                        const fin = h === 'HP' ? finalStats.HP : finalStats[h as Exclude<typeof h, 'HP'>];
                        const delta = fin - base;
                        return (
                            <div key={h} className="px-2 py-1 text-center tabular-nums">
                <span className={delta !== 0 ? (delta > 0 ? 'text-emerald-300 font-semibold' : 'text-red-300 font-semibold') : ''}>
                  {fin}
                </span>
                                {delta !== 0 && (
                                    <sup className={'ml-0.5 align-super text-[10px] ' + (delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
                                        {sign(delta)}
                                    </sup>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    /* ===== helper do efektĂłw: X â†’ valueInt ===== */
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

    /* ===== Karta broni ===== */
    function WeaponCard({ w }: { w: WeaponUI }) {
        const [selected, setSelected] = useState<string[]>(w.selectedProfileIds);

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
            <div className="vault-panel p-3">
                <div className="mb-1 flex items-center gap-2">
                    <div className="font-medium">{w.name}</div>
                    <div className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">{weaponTypeLabel}</div>
                </div>
                <div className="mt-1 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                    <div className={isMeleeWeapon ? 'max-w-full overflow-x-hidden' : 'max-w-full overflow-x-auto'}>
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
                                    return (
                                        <tr key={r.key} className="border-t border-zinc-800 align-top bg-zinc-950">
                                            {!isMeleeWeapon ? <td className="px-1 py-1 whitespace-normal break-all text-zinc-100">{range}</td> : null}
                                            <td className="px-1 py-1 whitespace-normal break-all text-zinc-100">{r.test ?? '-'}</td>
                                            <td className="px-1 py-1 whitespace-normal break-all text-zinc-300">{renderEffects(r.traits)}</td>
                                            <td className="px-1 py-1 whitespace-normal break-all text-zinc-300">{renderEffects(r.crits)}</td>
                                            <td className="px-1 py-1 text-center tabular-nums">{r.parts != null ? r.parts : '-'}</td>
                                            <td className="px-1 py-1 text-center tabular-nums">{r.rating != null ? r.rating : '-'}</td>
                                            <td className="px-0.5 py-1 text-center">
                                                {(() => {
                                                    if (r.kind !== 'PROFILE' || !r.profileId) {
                                                        return <span className="text-zinc-500">-</span>;
                                                    }
                                                    const profileId = r.profileId;
                                                    return (
                                                        <button
                                                            onClick={() => void toggle(profileId, !isSel)}
                                                            className={
                                                                'h-6 w-6 rounded-md border text-xs font-semibold leading-none ' +
                                                                (isSel
                                                                    ? 'border-emerald-500/50 bg-emerald-700/40 text-emerald-100'
                                                                    : 'border-emerald-500/50 bg-emerald-500 text-emerald-950')
                                                            }
                                                            title={isSel ? 'Cofnij ulepszenie' : 'Dodaj ulepszenie'}
                                                            aria-label={isSel ? 'Cofnij ulepszenie' : 'Dodaj ulepszenie'}
                                                        >
                                                            {isSel ? <CheckOutlined /> : <PlusOutlined />}
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
            setPhotoBuster(Date.now());
            router.refresh();
        } finally {
            setUploadingPhoto(false);
            setPick(null);
        }
    }

    async function deletePhoto() {
        confirmAction({
            title: 'Usunąć zdjęcie jednostki?',
            okText: 'Usuń',
            cancelText: 'Anuluj',
            danger: true,
            onOk: async () => {
                setUploadingPhoto(true);
                try {
                    const res = await fetch(`/api/units/${unitId}/photo`, { method: 'DELETE' });
                    if (!res.ok) throw new Error(await res.text());
                    router.refresh();
                } catch {
                    notifyApiError('Nie udało się usunąć zdjęcia jednostki.');
                    throw new Error('delete photo failed');
                } finally {
                    setUploadingPhoto(false);
                }
            },
        });
    }

    const normalizedTag = useMemo(() => normalizeRoleTag(roleTag), [roleTag]);

    return (
        <div className="space-y-3">
            <section className="vault-panel p-3">
                <div className="flex items-start gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                        {!photoMissing ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={photoSrc}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                onError={() => setPhotoMissing(true)}
                            />
                        ) : (
                            <div className="grid h-full w-full place-items-center text-xs text-zinc-500">Brak zdjÄ™cia</div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold truncate">{name}</div>
                            <TagChip tag={normalizedTag} />
                            {isLeader ? (
                                <span className="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
                                    LEADER
                                </span>
                            ) : null}
                            {tmpLeader ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                                    TEMP LEADER
                                </span>
                            ) : null}
                        </div>

                        {isLeader ? (
                            <div className="mt-2">
                                <label className="flex items-center gap-2 text-xs text-zinc-200">
                                    <input type="checkbox" checked={tmpLeader} onChange={(e) => void saveTemporaryLeader(e.target.checked)} />
                                    <span>Temporary Leader</span>
                                </label>
                            </div>
                        ) : null}

                        <div className="mt-1 text-[11px] text-zinc-400">ZdjÄ™cie jest przypisane do tej instancji w armii.</div>

                        <div className="mt-2 flex flex-wrap gap-2">
                            <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-200">
                                {uploadingPhoto ? 'Wysyłanie…' : (photoMissing ? 'Zrób / dodaj zdjęcie' : 'Zmień zdjęcie')}
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

                                        // wejĹ›ciowa walidacja (zanim otworzymy crop)
                                        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
                                        if (!allowed.includes(file.type)) {
                                             notifyWarning('Obsługiwane formaty: JPG/PNG/WebP');
                                            return;
                                        }
                                        if (file.size > 2 * 1024 * 1024) {
                                            notifyWarning('Plik za duży. Wybierz zdjęcie do 2MB.');
                                            return;
                                        }

                                        setPick(file);
                                    }}
                                />
                            </label>

                            {!photoMissing && (
                                <button
                                    type="button"
                                    onClick={() => void deletePhoto()}
                                    disabled={uploadingPhoto}
                                    className="h-9 rounded-xl border border-red-700 bg-red-900/30 px-3 text-xs font-medium text-red-200 disabled:opacity-50"
                                >
                                    Usuń
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* NagĹ‚Ăłwek + SPECIAL */}
            <section className="mt-3 vault-panel p-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 font-semibold truncate">{name}</div>
                    <div className="shrink-0 flex items-center gap-2">
                        <TagChip tag={normalizedTag} />
                        {!normalizedTag && roleTag ? (
                            <span className="text-[11px] text-zinc-500" title={roleTag}>
                                {roleTag}
                            </span>
                        ) : null}
                    </div>
                </div>
                <div className="mt-3">{renderSpecialCompact()}</div>
            </section>

            {/* BroĹ„ */}
            <section className="mt-4">
                <div className="text-sm font-medium">Broń</div>
                <div className="mt-2 grid gap-3">
                    {weapons.map((w) => (
                        <WeaponCard key={w.id} w={w} />
                    ))}
                    {weapons.length === 0 && <div className="text-zinc-500">Brak broni</div>}
                </div>
            </section>

            {/* Ulepszenia (+ Rany) */}
            <section className="mt-4 vault-panel p-3">
                <div className="text-sm font-medium">Ulepszenia</div>

                {/* Panel dodawania â€“ pozwala na wartoĹ›ci ujemne */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                        value={upStat}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUpStat(e.target.value as StatKey)}
                        className="vault-input px-2 py-1"
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
                        className="w-24 vault-input px-2 py-1 text-right"
                        placeholder="np. -1, 2"
                    />
                    <div className="flex gap-1">
                        {[-3, -2, -1, +1, +2, +3].map((d) => (
                            <button
                                key={d}
                                onClick={() => setUpDelta(d)}
                                className={
                                    'rounded-lg border px-2 py-1 text-xs ' +
                                    (d < 0 ? 'border-red-700/60 bg-red-900/20 text-red-300' : 'border-emerald-700/60 bg-emerald-900/20 text-emerald-300')
                                }
                                title={d < 0 ? 'Rana (ujemny modyfikator)' : 'Ulepszenie (dodatni)'}
                            >
                                {d > 0 ? `+${d}` : d}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => void addUpgrade()} className="rounded-xl bg-emerald-500 px-3 py-1 text-emerald-950">
                        Dodaj
                    </button>
                </div>

                <div className="mt-2 text-[11px] text-zinc-500">
                    * Ujemne modyfikacje (rany) <span className="text-red-400 font-medium">nie wliczają się do ratingu</span>.
                </div>

                {/* Listy: dodatnie / zerowe */}
                <div className="mt-3 grid gap-1 text-xs text-zinc-300">
                    {upgrades.filter((u) => u.delta >= 0).map((u) => (
                        <div
                            key={u.id}
                            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1"
                        >
                            <div>
                                <span className="font-medium">{u.statKey.toUpperCase()}</span>{' '}
                                {u.delta > 0 ? `+${u.delta}` : u.delta}
                                <span className="text-zinc-500"> • {new Date(u.at).toLocaleString()}</span>
                            </div>
                            <button
                                onClick={() => void deleteUpgrade(u.id)}
                                className="rounded-md border border-zinc-700 px-2 py-0.5 text-zinc-200 hover:bg-zinc-800"
                                aria-label="Cofnij ulepszenie"
                                title="Cofnij"
                            >
                                Cofnij
                            </button>
                        </div>
                    ))}
                    {upgrades.filter((u) => u.delta >= 0).length === 0 && (
                        <div className="text-zinc-500">Brak dodatnich ulepszeń</div>
                    )}
                </div>

                {/* Rany (ujemne) */}
                <div className="mt-4">
                    <div className="text-sm font-medium text-red-300">Rany (ujemne)</div>
                    <div className="mt-2 grid gap-1 text-xs">
                        {upgrades.filter((u) => u.delta < 0).map((u) => (
                            <div
                                key={u.id}
                                className="flex items-center justify-between rounded-lg border border-red-800 bg-red-950/40 px-2 py-1 text-red-200"
                            >
                                <div>
                                    <span className="font-semibold">{u.statKey.toUpperCase()}</span> {u.delta}
                                    <span className="ml-1 text-red-300/70">• {new Date(u.at).toLocaleString()}</span>
                                </div>
                                <button
                                    onClick={() => void deleteUpgrade(u.id)}
                                    className="rounded-md border border-red-700/70 px-2 py-0.5 hover:bg-red-900/30"
                                    aria-label="Usuń ranę"
                                    title="Cofnij"
                                >
                                    Cofnij
                                </button>
                            </div>
                        ))}
                        {upgrades.filter((u) => u.delta < 0).length === 0 && (
                            <div className="text-zinc-500">Brak ran</div>
                        )}
                    </div>
                </div>
            </section>

            {/* Perki */}
            <section className="mt-4 vault-panel p-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Perki</div>
                    <div className="text-[11px] text-zinc-500">Posiadane: {(ownedPerks ?? []).length}</div>
                </div>

                {/* Lista posiadanych */}
                <div className="mt-2 grid gap-2">
                    {(ownedPerks ?? []).map((p) => (
                        <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="font-medium">{p.name}</div>
                                </div>
                                {!p.isInnate || (p.statKey != null && p.minValue != null) ? (
                                    <button
                                        type="button"
                                        onClick={() => void removePerk(p.id)}
                                        className="shrink-0 rounded-lg border border-red-700/70 bg-red-900/20 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-900/30"
                                        title="Usuń perk"
                                    >
                                        Usuń
                                    </button>
                                ) : (
                                    <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                                        INNATE
                                    </span>
                                )}
                            </div>
                            <div className="mt-1 text-sm text-zinc-300 whitespace-pre-wrap">{p.description || 'â€”'}</div>
                        </div>
                    ))}
                    {(ownedPerks ?? []).length === 0 && <div className="text-sm text-zinc-500">Brak perkĂłw.</div>}
                </div>

                {/* Dodawanie */}
                <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-zinc-500">
                        Dostepne SPECIAL: <span className="font-semibold text-zinc-300">{specialPerks.length}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setPerkPickerOpen(true)}
                        className="rounded-xl bg-emerald-500 px-3 py-1 text-emerald-950"
                    >
                        Dodaj perk
                    </button>
                </div>
            </section>

            {perkPickerOpen && (
                <div className="fixed inset-0 z-30 overflow-x-hidden">
                    <button
                        aria-label="Zamknij"
                        onClick={() => setPerkPickerOpen(false)}
                        className="absolute inset-0 bg-black/60"
                    />

                    <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[88dvh] w-full max-w-screen-sm flex-col overflow-x-hidden rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-xl">
                        <div className="p-4 pb-3">
                            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-sm font-semibold">Dodaj perk SPECIAL</div>
                                    <div className="mt-0.5 text-[11px] text-zinc-400">Wyszukuj, filtruj i dodawaj perki z wymaganiami SPECIAL.</div>
                                </div>
                                <button
                                    onClick={() => setPerkPickerOpen(false)}
                                    className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
                                >
                                    Zamknij
                                </button>
                            </div>

                            <div className="mt-3">
                                <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                                    <SearchOutlined className="text-zinc-400" />
                                    <input
                                        value={perkSearch}
                                        onChange={(e) => setPerkSearch(e.target.value)}
                                        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                                        placeholder="Szukaj perka..."
                                    />
                                    {perkSearch && (
                                        <button
                                            onClick={() => setPerkSearch('')}
                                            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 active:scale-95"
                                            aria-label="Wyczysc"
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
                                                'rounded-full border px-2.5 py-1 text-xs font-medium ' +
                                                (active
                                                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                                                    : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                                            }
                                        >
                                            {k === 'ALL' ? 'Wszystkie' : k}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                                <select
                                    value={perkSort}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                        setPerkSort(e.target.value as 'CATEGORY' | 'NAME' | 'REQ_ASC' | 'REQ_DESC')
                                    }
                                    className="vault-input px-2 py-1 text-xs"
                                >
                                    <option value="CATEGORY">Sort: kategorie SPECIAL</option>
                                    <option value="REQ_ASC">Sort: wymaganie rosnaco</option>
                                    <option value="REQ_DESC">Sort: wymaganie malejaco</option>
                                    <option value="NAME">Sort: nazwa A-Z</option>
                                </select>
                                <div className="text-[11px] text-zinc-500">
                                    Wyniki: <span className="font-semibold text-zinc-300">{filteredPerks.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
                            <div className="grid gap-2">
                                {filteredPerks.map((p) => {
                                    const canAdd = p.meetsRequirement && !p.requiresValue && addingPerkId == null;
                                    return (
                                        <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="font-medium">{p.name}</div>
                                                    <div className="mt-1 text-[11px] text-zinc-400">
                                                        Wymaganie: {p.statKey} {p.minValue} • Masz: {p.currentValue}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={!canAdd || addingPerkId === p.id}
                                                    onClick={() => void addPerk(p.id)}
                                                    className={
                                                        'shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ' +
                                                        (canAdd
                                                            ? 'bg-emerald-500 text-emerald-950'
                                                            : 'border border-zinc-700 bg-zinc-900 text-zinc-500')
                                                    }
                                                >
                                                    {addingPerkId === p.id ? 'Dodawanie...' : 'Dodaj'}
                                                </button>
                                            </div>
                                            <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{p.description || '—'}</div>
                                            {p.requiresValue ? (
                                                <div className="mt-2 text-xs text-amber-300">Ten perk wymaga valueInt (jeszcze nieobslugiwane).</div>
                                            ) : null}
                                            {!p.meetsRequirement ? (
                                                <div className="mt-2 text-xs text-red-300">Niespelnione wymaganie SPECIAL.</div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                                {filteredPerks.length === 0 ? (
                                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-500">
                                        Brak perkow dla aktualnych filtrow.
                                    </div>
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
                    maxBytes={3 * 1024 * 1024}
                    onCancel={() => setPick(null)}
                    onConfirm={(blob) => void uploadPhoto(blob)}
                />
            )}
        </div>
    );
}

// (intentionally no re-export alias here)

