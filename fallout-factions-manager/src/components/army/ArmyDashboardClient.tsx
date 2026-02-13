'use client';

import { AppstoreOutlined, CloseOutlined, DeploymentUnitOutlined, DownOutlined, SearchOutlined, StarOutlined, UpOutlined } from '@ant-design/icons';
import { FilterBar, QuickToggle, type ActiveFilterChip } from '@/components/ui/filters';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EffectTooltip, usePreloadEffects } from '@/components/effects/EffectTooltip';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';

type Kind = 'caps' | 'parts' | 'reach' | 'exp';

/* ==== typy broni zgodne z logiką override ==== */
type EffectKind = 'WEAPON' | 'CRITICAL';
type UIEffect = {
    id: string;
    effectId?: string;
    name: string;
    kind: EffectKind;
    valueInt: number | null;
};
type UIProfile = {
    id: string;
    typeOverride: string | null;
    testOverride: string | null;
    effects: UIEffect[];
    parts?: number | null;
    rating?: number | null;
};

type UnitListItem = {
    id: string;
    templateName: string;
    roleTag: string | null;
    base: { hp: number } & Record<'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L', number>;
    bonus: Record<'HP' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L', number>;
    wounds: number;
    present: boolean;
    upgradesCount: number;
    perkNames: string[];
    startPerkNames?: string[];
    photoPath: string | null;
    rating: number;

    weapons: {
        name: string;
        selectedProfileIds: string[];
        baseType: string;
        baseTest: string;
        baseEffects: UIEffect[];
        profiles: UIProfile[];
    }[];

    isLeader?: boolean;
    temporaryLeader?: boolean;
};

type RoleFilter = 'ALL' | 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS';
type TabKey = 'OVERVIEW' | 'EDIT' | 'TASKS' | 'TURF';

/* ====== Goals API ====== */
type Goal = {
    id: string;
    tier: 1 | 2 | 3;
    description: string;
    target: number;
    order: number;
    ticks: number;
};
type GoalsResponse = {
    armyId: string;
    currentTier: number;
    set: { id: string; name: string } | null;
    goals: Goal[];
};

export function ArmyDashboardClient({
    armyId,
    armyName,
    tier,
    factionId,                 // <<<<<< DODANE
    factionName,
    resources,
    units,
    rating,
    subfactionId,
}: {
    armyId: string;
    armyName: string;
    tier: number;
    factionId: string;         // <<<<<< DODANE
    factionName: string;
    resources: Record<Kind, number>;
    units: UnitListItem[];
    rating: number;
    subfactionId?: string | null;
}) {
    return <ArmyDashboardClientInner
        armyId={armyId}
        armyName={armyName}
        tier={tier}
        factionId={factionId}
        factionName={factionName}
        resources={resources}
        units={units}
        rating={rating}
        subfactionId={subfactionId}
    />;
}

function ArmyDashboardClientInner({
    armyId,
    armyName,
    tier,
    factionId,                 // <<<<<< DODANE
    factionName,
    resources,
    units,
    rating,
    subfactionId,
}: {
    armyId: string;
    armyName: string;
    tier: number;
    factionId: string;         // <<<<<< DODANE
    factionName: string;
    resources: Record<Kind, number>;
    units: UnitListItem[];
    rating: number;
    subfactionId?: string | null;
}) {
    const router = useRouter();
    const [totals, setTotals] = useState(resources);
    const [busy, setBusy] = useState<Kind | null>(null);
    const [adding, setAdding] = useState(false);
    const [filter, setFilter] = useState<RoleFilter>('ALL');
    const [hideInactive, setHideInactive] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>('OVERVIEW');

    useEffect(() => setTotals(resources), [resources]);

    async function setValue(kind: Kind, value: number) {
        const v = Math.max(0, Math.floor(value));
        setBusy(kind);
        try {
            const res = await fetch(`/api/armies/${armyId}/resources`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [kind]: v }),
            });
            if (!res.ok) throw new Error(await res.text());
            setTotals((t) => ({ ...t, [kind]: v }));
        } catch {
            notifyApiError('Nie udało się zapisać zasobów');
        } finally {
            setBusy(null);
        }
    }

    async function deleteUnit(unitId: string) {
        confirmAction({
            title: 'Na pewno usunąć tę jednostkę z armii?',
            okText: 'Usuń',
            cancelText: 'Anuluj',
            danger: true,
            onOk: async () => {
                setDeletingId(unitId);
                try {
                    const res = await fetch(`/api/armies/${armyId}/units/${unitId}`, { method: 'DELETE' });
                    if (!res.ok) {
                        const txt = await res.text().catch(() => '');
                        throw new Error(txt || 'Request failed');
                    }
                    router.refresh();
                } catch {
                    notifyApiError('Nie udało się usunąć jednostki');
                    throw new Error('delete failed');
                } finally {
                    setDeletingId(null);
                }
            },
        });
    }

    function n(v: string, def = 0) {
        const x = Number(v);
        return Number.isFinite(x) ? x : def;
    }

    const groups = useMemo(() => {
        const champion: UnitListItem[] = [];
        const grunt: UnitListItem[] = [];
        const companion: UnitListItem[] = [];
        const legends: UnitListItem[] = [];
        for (const u of units) {
            const tag = (u.roleTag ?? 'GRUNT').toUpperCase();
            if (tag === 'LEGENDS') legends.push(u);
            else if (tag === 'CHAMPION') champion.push(u);
            else if (tag === 'COMPANION') companion.push(u);
            else grunt.push(u);
        }
        return { champion, grunt, companion, legends };
    }, [units]);

    const filtered = useMemo(() => {
        const key =
            filter === 'CHAMPION'
                ? 'champion'
                : filter === 'GRUNT'
                    ? 'grunt'
                    : filter === 'COMPANION'
                        ? 'companion'
                        : filter === 'LEGENDS'
                            ? 'legends'
                            : null;

        const base = key ? groups[key] : units;

        return base.filter((u) => {
            if (!hideInactive) return true;
            if (!u.present) return false;
            const maxHp = u.base.hp + u.bonus.HP;
            const dead = (u.wounds ?? 0) >= maxHp;
            if (dead) return false;
            return true;
        });
    }, [filter, units, groups, hideInactive]);

    /* ---------- SPECIAL (kompakt) ---------- */
    function SpecialCompact({
                                base,
                                bonus,
                            }: {
        base: UnitListItem['base'];
        bonus: UnitListItem['bonus'];
    }) {
        const HEAD = ['S', 'P', 'E', 'C', 'I', 'A', 'L', 'HP'] as const;
        const sign = (x: number) => (x > 0 ? `+${x}` : `${x}`);

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
                        const baseVal = h === 'HP' ? base.hp : base[h as Exclude<typeof h, 'HP'>];
                        const finalVal =
                            h === 'HP' ? base.hp + bonus.HP : base[h as Exclude<typeof h, 'HP'>] + bonus[h as Exclude<typeof h, 'HP'>];
                        const delta = finalVal - baseVal;
                        return (
                            <div key={h} className="px-2 py-1 text-center tabular-nums">
                <span className={delta !== 0 ? (delta > 0 ? 'text-emerald-300 font-semibold' : 'text-red-300 font-semibold') : ''}>
                  {finalVal}
                </span>
                                {delta !== 0 && (
                                    <sup className={'ml-0.5 align-super text-[10px] ' + (delta > 0 ? 'text-emerald-400' : 'text-red-400')}>{sign(delta)}</sup>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    /* ---------- helper: X -> valueInt ---------- */
    function formatEffect(name: string, valueInt: number | null): string {
        if (valueInt == null) return name;
        const out = name.replace(/\(\s*X\s*\)/g, String(valueInt)).replace(/\bX\b/g, String(valueInt));
        if (out !== name) return out;
        return `${name} (${valueInt})`;
    }

    function EffectChip({ e }: { e: UIEffect }) {
        const label = formatEffect(e.name, e.valueInt);
        if (e.effectId) {
            return (
                <EffectTooltip
                    effectId={e.effectId}
                    label={label}
                    className="cursor-help underline decoration-dotted underline-offset-2"
                />
            );
        }
        return <span className="cursor-default">{label}</span>;
    }

    function EffectsInline({ effects, kind }: { effects: UIEffect[]; kind: UIEffect['kind'] }) {
        const items = effects.filter((x) => x.kind === kind);
        if (items.length === 0) return <span>—</span>;
        return (
            <span className="whitespace-normal break-words">
                {items.map((e, idx) => (
                    <span key={`${e.id}_${idx}`}>
                        <EffectChip e={e} />
                        {idx < items.length - 1 ? ', ' : ''}
                    </span>
                ))}
            </span>
        );
    }

    /* ---------- helper: wylicz finalne pola broni ---------- */
    function computeWeaponDisplay(w: UnitListItem['weapons'][number]) {
        const rev = [...w.selectedProfileIds].reverse();
        const overId = rev.find((id) => {
            const p = w.profiles.find((pp) => pp.id === id);
            return Boolean(p && (p.typeOverride != null || p.testOverride != null));
        });

        const over = overId ? w.profiles.find((pp) => pp.id === overId) ?? null : null;

        const type = over?.typeOverride ?? w.baseType;
        const test = over?.testOverride ?? w.baseTest;

        const agg = new Map<string, UIEffect>();
        for (const e of w.baseEffects) {
            const key = `${e.kind}:${e.name}:${e.valueInt ?? ''}`;
            agg.set(key, e);
        }
        for (const pId of w.selectedProfileIds) {
            const p = w.profiles.find((pp) => pp.id === pId);
            if (!p) continue;
            for (const e of p.effects) {
                const key = `${e.kind}:${e.name}:${e.valueInt ?? ''}`;
                agg.set(key, e);
            }
        }

        const allEffects = [...agg.values()];

        return { type, test, allEffects };
    }

    /* ---------- Wiersz jednostki ---------- */
    function UnitRow({
                         u,
                         armyId: aId,
                         onDelete,
                         deleting,
                     }: {
        u: UnitListItem;
        armyId: string;
        onDelete: () => void;
        deleting: boolean;
    }) {
        // preload efektów dla tej jednostki (żeby tooltipy były natychmiast)
        const effectIdsToPreload = useMemo(() => {
            const ids: string[] = [];
            for (const w of u.weapons) {
                for (const e of w.baseEffects) if (e.effectId) ids.push(e.effectId);
                for (const p of w.profiles) for (const e of p.effects) if (e.effectId) ids.push(e.effectId);
            }
            return ids;
        }, [u.weapons]);
        usePreloadEffects(effectIdsToPreload);

        const [wounds, setWounds] = useState(u.wounds);
        const [absent, setAbsent] = useState(!u.present);
        const [tmpLeader, setTmpLeader] = useState(Boolean(u.temporaryLeader));

        async function savePresence(nextPresent: boolean) {
            const prev = absent;
            setAbsent(!nextPresent);
            const res = await fetch(`/api/units/${u.id}/presence`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ present: nextPresent }),
            }).catch(() => null);

            if (!res || !res.ok) {
                setAbsent(prev);
                notifyApiError('Nie udało się zapisać obecności.');
                return;
            }

            router.refresh();
        }

        async function saveWounds(next: number) {
            const prev = wounds;
            setWounds(next);
            const res = await fetch(`/api/units/${u.id}/wounds`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wounds: next }),
            }).catch(() => null);

            if (!res || !res.ok) {
                setWounds(prev);
                notifyApiError('Nie udało się zapisać ran.');
                return;
            }

            router.refresh();
        }

        async function saveTemporaryLeader(next: boolean) {
            const prev = tmpLeader;
            setTmpLeader(next);

            const res = await fetch(`/api/units/${u.id}/temporary-leader`, {
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

        const maxHp = u.base.hp + u.bonus.HP;
        const dmg = Math.max(0, Math.min(maxHp, wounds));

        function DmgBoxes() {
            return (
                <div
                    className="flex flex-wrap items-center gap-1"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    {/* 0 = full HP (brak DMG). Każdy zaznaczony checkbox = 1 DMG */}
                    {Array.from({ length: maxHp }, (_, i) => {
                        const idx = i + 1; // 1..maxHp (kolejny punkt DMG)
                        const checked = idx <= dmg;
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                    // klik ustawia DMG do idx (jeśli klikasz już zaznaczony najwyższy, to cofamy o 1)
                                    const nextDmg = checked && dmg === idx ? idx - 1 : idx;
                                    void saveWounds(Math.max(0, Math.min(maxHp, nextDmg)));
                                }}
                                className={
                                    'relative h-6 w-6 rounded-md border transition-colors ' +
                                    (checked
                                        ? 'border-red-700/60 bg-red-950/40'
                                        : 'border-zinc-700 bg-zinc-950')
                                }
                                aria-label={checked ? `DMG ${idx} (odkliknij)` : `Ustaw DMG na ${idx}`}
                                title={checked ? `DMG ${idx}` : `Ustaw DMG: ${idx}`}
                            >
                                {/* checkbox */}
                                <span
                                    className={
                                        'absolute inset-0 grid place-items-center text-[10px] font-bold ' +
                                        (checked ? 'text-red-200' : 'text-zinc-400')
                                    }
                                >
                                    {checked ? '■' : '□'}
                                </span>

                                {/* skreślenie dla DMG */}
                                {checked && (
                                    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
                                        <span className="absolute left-1/2 top-1/2 h-[2px] w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-red-300/70" />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            );
        }

        return (
            <Link href={`/army/${aId}/unit/${u.id}`} className="block max-w-full overflow-hidden vault-panel p-3">
                <div className="flex items-center justify-between">
                    <div className="font-medium">{u.templateName}</div>
                    <div className="flex items-center gap-2">
                        {u.isLeader ? (
                            <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                                LEADER
                            </span>
                        ) : null}
                        {tmpLeader ? (
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                                TEMP LEADER
                            </span>
                        ) : null}
                        <div className="text-xs text-zinc-400">
                            Rating <span className="font-semibold text-zinc-200">{u.rating}</span>
                        </div>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDelete();
                            }}
                            disabled={deleting}
                            className="rounded-md border border-red-600/50 px-2 py-1 text-xs text-red-300 hover:bg-red-600/10 disabled:opacity-50"
                            aria-label="Usuń jednostkę"
                            title="Usuń jednostkę"
                        >
                            {deleting ? 'Usuwanie…' : 'Usuń'}
                        </button>
                    </div>
                </div>

                <div className="mt-2">
                    <SpecialCompact base={u.base} bonus={u.bonus} />
                </div>

                <div className="mt-2 grid gap-2">
                    {u.weapons.map((w, idx) => {
                        const d = computeWeaponDisplay(w);
                        return (
                            <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-950">
                                <div className="block min-[400px]:hidden">
                                    <div className="grid grid-cols-[36%_64%] border-t first:border-t-0 border-zinc-800">
                                        <div className="bg-teal-700/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-50">Weapon</div>
                                        <div className="px-2 py-1 text-sm whitespace-normal break-words">{w.name}</div>
                                    </div>
                                    <div className="grid grid-cols-[36%_64%] border-t border-zinc-800">
                                        <div className="bg-teal-700/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-50">Type</div>
                                        <div className="px-2 py-1 text-sm whitespace-normal break-words">{d.type}</div>
                                    </div>
                                    <div className="grid grid-cols-[36%_64%] border-t border-zinc-800">
                                        <div className="bg-teal-700/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-50">Test</div>
                                        <div className="px-2 py-1 text-sm whitespace-normal break-words">{d.test}</div>
                                    </div>
                                    <div className="grid grid-cols-[36%_64%] border-t border-zinc-800">
                                        <div className="bg-teal-700/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-50">Traits</div>
                                        <div className="px-2 py-1 text-sm whitespace-normal break-words"><EffectsInline effects={d.allEffects} kind="WEAPON" /></div>
                                    </div>
                                    <div className="grid grid-cols-[36%_64%] border-t border-zinc-800">
                                        <div className="bg-teal-700/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-50">Critical Effect</div>
                                        <div className="px-2 py-1 text-sm whitespace-normal break-words"><EffectsInline effects={d.allEffects} kind="CRITICAL" /></div>
                                    </div>
                                </div>

                                <div className="hidden min-[400px]:block overflow-x-auto">
                                    <table className="w-full table-auto text-sm">
                                        <thead>
                                            <tr className="bg-teal-700/70 text-[11px] font-semibold uppercase tracking-wide text-teal-50">
                                                <th className="px-2 py-1 text-left">Type</th>
                                                <th className="px-2 py-1 text-left">Test</th>
                                                <th className="px-2 py-1 text-left">Traits</th>
                                                <th className="px-2 py-1 text-left">Critical Effect</th>
                                                <th className="px-2 py-1 text-left">Parts</th>
                                                <th className="px-2 py-1 text-left">Rating</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-t border-zinc-800 align-top">
                                                <td className="px-2 py-1 whitespace-normal break-words">{d.type}</td>
                                                <td className="px-2 py-1 whitespace-normal break-words">{d.test}</td>
                                                <td className="px-2 py-1 whitespace-normal break-words text-zinc-300">
                                                    <EffectsInline effects={d.allEffects} kind="WEAPON" />
                                                </td>
                                                <td className="px-2 py-1 whitespace-normal break-words text-zinc-300">
                                                    <EffectsInline effects={d.allEffects} kind="CRITICAL" />
                                                </td>
                                                <td className="px-2 py-1">—</td>
                                                <td className="px-2 py-1">—</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <label
                        className="flex items-center gap-1 text-xs"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <input type="checkbox" checked={absent} onChange={(e) => void savePresence(!e.target.checked)} />
                        <span>Absent</span>
                    </label>

                    <label
                        className="flex items-center gap-1 text-xs"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        title={u.isLeader ? 'Ustaw jako Temporary Leader w tej armii' : 'Ta jednostka nie ma tagu LEADER na templacie'}
                    >
                        <input
                            type="checkbox"
                            checked={tmpLeader}
                            disabled={!u.isLeader}
                            onChange={(e) => void saveTemporaryLeader(e.target.checked)}
                        />
                        <span className={!u.isLeader ? 'text-zinc-500' : ''}>Temporary Leader</span>
                    </label>

                    <div
                        className="flex items-center gap-2 text-xs"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <span className="text-zinc-400">DMG</span>
                        <DmgBoxes />
                     </div>
                 </div>
             </Link>
         );
     }

    /* ====== Ikony ====== */
    const ICON: Record<Kind, React.ReactNode> = {
        caps: <DeploymentUnitOutlined className="text-zinc-200" />,
        parts: <AppstoreOutlined className="text-zinc-200" />,
        exp: <StarOutlined className="text-zinc-200" />,
        reach: 'REACH',
    };

    /* ====== HOME TURF – stan i metody ====== */
    type Facility = { id: string; name: string };
    const [hazard, setHazard] = useState<string>('');
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [ftNew, setFtNew] = useState('');
    const [savingHazard, setSavingHazard] = useState(false);
    const [loadingTurf, setLoadingTurf] = useState(false);
    const [addingFac, setAddingFac] = useState(false);
    const [deletingFacId, setDeletingFacId] = useState<string | null>(null);

    async function loadTurf() {
        setLoadingTurf(true);
        try {
            const res = await fetch(`/api/armies/${armyId}/home-turf`, { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const data = (await res.json()) as { hazard: string; facilities: Facility[] };
            setHazard(data.hazard ?? '');
            setFacilities(data.facilities ?? []);
        } catch {
            // noop
        } finally {
            setLoadingTurf(false);
        }
    }

    // Lazy load TURF
    useEffect(() => {
        if (tab === 'TURF') void loadTurf();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    async function saveHazard() {
        setSavingHazard(true);
        try {
            const res = await fetch(`/api/armies/${armyId}/home-turf`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hazard }),
            });
            if (!res.ok) {
                const t = await res.text().catch(() => '');
                throw new Error(t || 'fail');
            }
        } catch {
            notifyApiError('Nie udało się zapisać hazardu');
        } finally {
            setSavingHazard(false);
        }
    }

    async function addFacility() {
        const name = ftNew.trim();
        if (!name) return;
        setAddingFac(true);
        try {
            const res = await fetch(`/api/armies/${armyId}/home-turf/facilities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) throw new Error();
            const created = (await res.json()) as Facility;
            setFacilities((f) => [created, ...f]);
            setFtNew('');
        } catch {
            notifyApiError('Nie udało się dodać facility');
        } finally {
            setAddingFac(false);
        }
    }

    async function deleteFacility(id: string) {
        confirmAction({
            title: 'Usunąć to facility?',
            okText: 'Usuń',
            cancelText: 'Anuluj',
            danger: true,
            onOk: async () => {
                setDeletingFacId(id);
                try {
                    const res = await fetch(`/api/armies/${armyId}/home-turf/facilities/${id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error();
                    setFacilities((f) => f.filter((x) => x.id !== id));
                } catch {
                    notifyApiError('Nie udało się usunąć facility');
                    throw new Error('delete failed');
                } finally {
                    setDeletingFacId(null);
                }
            },
        });
    }

    /* ====== TASKS (Goals) – stan i metody ====== */
    const [goalsSet, setGoalsSet] = useState<{ id: string; name: string } | null>(null);
    const [currentTier, setCurrentTier] = useState<number>(tier);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loadingGoals, setLoadingGoals] = useState(false);
    const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null);

    async function loadGoals() {
        setLoadingGoals(true);
        try {
            const res = await fetch(`/api/armies/${armyId}/goals`, { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const data = (await res.json()) as GoalsResponse;
            setGoalsSet(data.set);
            setCurrentTier(data.currentTier);
            setGoals(data.goals ?? []);
        } catch {
            // noop
        } finally {
            setLoadingGoals(false);
        }
    }

    async function advanceTier() {
        confirmAction({
            title: 'Zwiększyć tier armii?',
            content: 'Wymaga ukończenia wszystkich zadań na aktualnym tierze.',
            okText: 'Zwiększ tier',
            cancelText: 'Anuluj',
            onOk: async () => {
                try {
                    const res = await fetch(`/api/armies/${armyId}/tier`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'advance' }),
                    });
                    if (!res.ok) {
                        const json = (await res.json().catch(() => null)) as { error?: string } | null;
                        if (json?.error === 'TIER_NOT_COMPLETED') {
                            notifyWarning('Nie możesz zwiększyć tieru: nie wszystkie zadania na tym tierze są ukończone.');
                        } else if (json?.error === 'NO_ACTIVE_SET') {
                            notifyWarning('Nie możesz zwiększyć tieru: brak aktywnego zestawu zadań.');
                        } else {
                            const t = await res.text().catch(() => '');
                            notifyApiError(t || 'Nie udało się zwiększyć tieru.');
                        }
                        throw new Error('advance tier failed');
                    }

                    const updated = (await res.json().catch(() => null)) as { tier?: number } | null;
                    if (updated?.tier) setCurrentTier(updated.tier);
                    await loadGoals();
                    router.refresh();
                } catch {
                    throw new Error('tier failed');
                }
            }
        });
    }

    // Lazy load TASKS
    useEffect(() => {
        if (tab === 'TASKS') void loadGoals();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    async function setGoalTicks(goalId: string, next: number) {
        const g = goals.find((x) => x.id === goalId);
        if (!g) return;
        const clamped = Math.max(0, Math.min(g.target, next));
        if (clamped === g.ticks) return;

        setUpdatingGoalId(goalId);
        // optimistic UI
        setGoals((arr) => arr.map((x) => (x.id === goalId ? { ...x, ticks: clamped } : x)));
        try {
            const res = await fetch(`/api/armies/${armyId}/goals/${goalId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticks: clamped }),
            });
            if (!res.ok) throw new Error();
        } catch {
            // rollback
            setGoals((arr) => (g ? arr.map((x) => (x.id === goalId ? { ...x, ticks: g.ticks } : x)) : arr));
            notifyApiError('Nie udało się zapisać postępu celu');
        } finally {
            setUpdatingGoalId(null);
        }
    }

    const goalsByTier = useMemo(() => {
        const map: Record<1 | 2 | 3, Goal[]> = { 1: [], 2: [], 3: [] };
        for (const g of goals) map[g.tier].push(g);
        for (const t of [1, 2, 3] as const) map[t].sort((a, b) => a.order - b.order);
        return map;
    }, [goals]);

    function doneInTier(t: 1 | 2 | 3) {
        const arr = goalsByTier[t];
        if (arr.length === 0) return 0;
        return arr.filter((g) => g.ticks >= g.target).length;
    }

    return (
        <main className="mx-auto max-w-screen-sm px-3 pb-24">
            {/* META */}
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                <div>
                    <span className="font-medium text-zinc-300">{armyName}</span> • {factionName} • Tier {tier}
                </div>
                <div className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px]">
                    Rating: <span className="font-semibold text-zinc-200">{rating}</span>
                </div>
            </div>

            {/* TABS */}
            <div className="mt-3 grid grid-cols-4 gap-2">
                {([
                    ['OVERVIEW', 'Przegląd'],
                    ['EDIT', 'Edycja zasobów'],
                    ['TASKS', 'Zadania'],
                    ['TURF', 'Home Turf'],
                ] as [TabKey, string][]).map(([k, label]) => (
                    <button
                        key={k}
                        onClick={() => setTab(k)}
                        className={
                            'h-10 rounded-xl border text-xs font-medium ' +
                            (tab === k ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                        }
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* OVERVIEW */}
            {tab === 'OVERVIEW' && (
                <>
                    {/* Zasoby – jedna linia (read-only) */}
                    <section className="mt-3 vault-panel p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-medium">Zasoby</div>
                            <button onClick={() => setAdding(true)} className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs">
                                Dodaj jednostkę
                            </button>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto">
                            {(['caps', 'parts', 'exp', 'reach'] as Kind[]).map((k) => (
                                <div key={k} className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" title={k.toUpperCase()}>
                                    <span className="text-base">{ICON[k]}</span>
                                    <span className="tabular-nums font-semibold">{totals[k]}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* FILTER */}
                    <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3">
                        <FilterBar
                            controls={
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                                    {(['ALL', 'CHAMPION', 'GRUNT', 'COMPANION', 'LEGENDS'] as RoleFilter[]).map((f) => (
                                        <QuickToggle key={f} checked={filter === f} onChange={() => setFilter(f)} label={f} />
                                    ))}
                                </div>
                            }
                            moreFilters={
                                <QuickToggle
                                    checked={hideInactive}
                                    onChange={setHideInactive}
                                    label="Chowaj nieaktywne (absent / dead)"
                                />
                            }
                            activeChips={[
                                ...(filter !== 'ALL' ? [{ key: 'role', label: `Rola: ${filter}`, onRemove: () => setFilter('ALL') }] : []),
                                ...(hideInactive ? [{ key: 'inactive', label: 'Ukryte nieaktywne', onRemove: () => setHideInactive(false) }] : []),
                            ] as ActiveFilterChip[]}
                            onClearAll={() => {
                                setFilter('ALL');
                                setHideInactive(false);
                            }}
                        />
                    </div>

                    {/* JEDNOSTKI */}
                    <section className="mt-4">
                        <div className="text-sm font-medium">Jednostki</div>
                        <div className="mt-2 grid gap-2">
                            {filtered.map((u) => (
                                <UnitRow key={u.id} u={u} armyId={armyId} deleting={deletingId === u.id} onDelete={() => void deleteUnit(u.id)} />
                            ))}
                            {filtered.length === 0 && <div className="text-sm text-zinc-500">Brak jednostek dla filtra</div>}
                        </div>
                    </section>
                </>
            )}

            {/* EDIT RESOURCES */}
            {tab === 'EDIT' && (
                <section className="mt-3 vault-panel p-3">
                    <div className="mb-2 text-sm font-medium">Edycja zasobów</div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {(['caps', 'parts', 'exp', 'reach'] as const).map((k) => (
                            <div key={k} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                                <div className="flex items-center gap-2 text-[10px] uppercase text-zinc-400">
                                    <span className="text-sm">{ICON[k]}</span>
                                    <span>{k}</span>
                                </div>
                                <div className="mt-2 flex min-w-0 items-center gap-2">
                                    <button
                                        className="h-10 w-12 shrink-0 rounded-xl border border-zinc-700 bg-zinc-900 text-lg font-bold active:scale-95"
                                        onClick={() => void setValue(k, totals[k] - 1)}
                                        disabled={busy === k}
                                        aria-label="minus jeden"
                                    >
                                        −
                                    </button>
                                    <input
                                        inputMode="numeric"
                                        value={totals[k]}
                                        onChange={(e) => setTotals((t) => ({ ...t, [k]: Math.max(0, Math.floor(n(e.target.value, t[k]))) }))}
                                        onBlur={(e) => void setValue(k, n(e.target.value, totals[k]))}
                                        className="h-10 min-w-0 flex-1 vault-input px-3 text-center text-lg"
                                    />
                                    <button
                                        className="h-10 w-12 shrink-0 rounded-xl border border-zinc-700 bg-zinc-900 text-lg font-bold active:scale-95"
                                        onClick={() => void setValue(k, totals[k] + 1)}
                                        disabled={busy === k}
                                        aria-label="plus jeden"
                                    >
                                        +
                                    </button>
                                </div>

                                <div className="mt-2 grid grid-cols-4 gap-1">
                                    {[-10, -5, +5, +10].map((d) => (
                                        <button
                                            key={d}
                                            className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 text-xs active:scale-95 disabled:opacity-50"
                                            onClick={() => void setValue(k, Math.max(0, totals[k] + d))}
                                            disabled={busy === k}
                                        >
                                            {d > 0 ? `+${d}` : d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* TASKS – trackowanie postępu celów */}
            {tab === 'TASKS' && (
                <section className="mt-3 vault-panel p-3">
                    <div className="mb-1 flex items-center justify-between">
                        <div className="text-sm font-medium">Zadania</div>
                        <button
                            onClick={() => void loadGoals()}
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs"
                            aria-label="Odśwież cele"
                            title="Odśwież"
                        >
                            Odśwież
                        </button>
                    </div>

                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-xs text-zinc-400">
                            Aktualny tier: <span className="font-semibold text-zinc-200">T{currentTier}</span>
                        </div>
                        <button
                            onClick={() => void advanceTier()}
                            className="rounded-xl bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 active:scale-95"
                            aria-label="Zwiększ tier"
                            title="Zwiększ tier"
                        >
                            Zwiększ tier
                        </button>
                    </div>

                    {loadingGoals && <div className="text-xs text-zinc-400">Ładowanie…</div>}

                    {!loadingGoals && !goalsSet && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                            Brak aktywnego zestawu zadań dla tej armii.
                        </div>
                    )}

                    {!loadingGoals && goalsSet && (
                        <>
                            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
                                <div>
                                    Zestaw: <span className="font-semibold text-zinc-200">{goalsSet.name}</span>
                                </div>
                                <div className="mt-1">
                                    Aktualny tier armii: <span className="font-semibold text-zinc-200">T{currentTier}</span>
                                </div>
                                <div className="mt-2 flex gap-2 text-[11px] text-zinc-400">
                                    {[1, 2, 3].map((t) => (
                                        <span key={t} className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5">
                      T{t}: {doneInTier(t as 1 | 2 | 3)}/{goalsByTier[t as 1 | 2 | 3].length} ukończonych
                    </span>
                                    ))}
                                </div>
                            </div>

                            {[1, 2, 3].map((t) => {
                                const arr = goalsByTier[t as 1 | 2 | 3];
                                if (arr.length === 0) return null;
                                return (
                                    <div key={t} className="mt-4">
                                        <div className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-400">TIER {t}</div>
                                        <div className="grid gap-2">
                                            {arr.map((g) => {
                                                const filled = g.ticks;
                                                const total = g.target;
                                                return (
                                                    <div key={g.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="text-sm text-zinc-100">{g.description}</div>
                                                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                                    {Array.from({ length: total }, (_, i) => {
                                                                        const val = i + 1; // 1..target
                                                                        const active = filled >= val;
                                                                        return (
                                                                            <button
                                                                                key={i}
                                                                                onClick={() => void setGoalTicks(g.id, active && filled === val ? val - 1 : val)}
                                                                                disabled={updatingGoalId === g.id}
                                                                                className={
                                                                                    'h-6 w-6 rounded-full border text-xs tabular-nums ' +
                                                                                    (active ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-zinc-700 bg-zinc-900 text-zinc-400')
                                                                                }
                                                                                title={active ? `Cofnij do ${val - 1}` : `Ustaw na ${val}`}
                                                                                aria-label={active ? `Cofnij do ${val - 1}` : `Ustaw na ${val}`}
                                                                            >
                                                                                {val}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                            <div className="shrink-0 text-xs text-zinc-400">
                                                                {filled}/{total}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </section>
            )}

            {/* TURF */}
            {tab === 'TURF' && (
                <section className="mt-3 vault-panel p-3">
                    <div className="text-sm font-medium">Home Turf</div>

                    {/* Hazard */}
                    <div className="mt-3">
                        <label className="text-xs text-zinc-400">Hazard</label>
                        <textarea
                            value={hazard}
                            onChange={(e) => setHazard(e.target.value)}
                            rows={3}
                            className="mt-1 w-full vault-input px-3 py-2 text-sm"
                            placeholder="Opis zagrożeń terenu…"
                        />
                        <div className="mt-2 flex items-center gap-2">
                            <button
                                onClick={() => void saveHazard()}
                                disabled={savingHazard}
                                className="rounded-xl bg-emerald-500 px-3 py-1 text-sm font-semibold text-emerald-950 disabled:opacity-50"
                            >
                                {savingHazard ? 'Zapisywanie…' : 'Zapisz hazard'}
                            </button>
                            {loadingTurf && <span className="text-xs text-zinc-500">Ładowanie…</span>}
                        </div>
                    </div>

                    {/* Facilities */}
                    <div className="mt-5">
                        <div className="text-sm font-medium">Facilities</div>

                        <div className="mt-2 flex gap-2">
                            <input
                                value={ftNew}
                                onChange={(e) => setFtNew(e.target.value)}
                                className="flex-1 vault-input px-3 py-2 text-sm"
                                placeholder="np. Warsztat, Farma, Pancerna Brama…"
                            />
                            <button
                                onClick={() => void addFacility()}
                                disabled={addingFac}
                                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-50"
                            >
                                {addingFac ? 'Dodawanie…' : 'Dodaj'}
                            </button>
                        </div>

                        <div className="mt-2 grid gap-2">
                            {facilities.map((f) => (
                                <div key={f.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                                    <div className="text-sm">{f.name}</div>
                                    <button
                                        onClick={() => void deleteFacility(f.id)}
                                        disabled={deletingFacId === f.id}
                                        className="rounded-md border border-red-600/50 px-2 py-1 text-xs text-red-300 hover:bg-red-600/10 disabled:opacity-50"
                                        aria-label="Usuń facility"
                                        title="Usuń facility"
                                    >
                                        {deletingFacId === f.id ? 'Usuwanie…' : 'Usuń'}
                                    </button>
                                </div>
                            ))}
                            {facilities.length === 0 && <div className="text-sm text-zinc-500">Brak facilities — dodaj pierwsze powyżej.</div>}
                        </div>
                    </div>
                </section>
            )}

            {adding && (
                <AddUnitSheet
                    armyId={armyId}
                    factionId={factionId}
                    subfactionId={subfactionId ?? null}
                    onClose={() => {
                        setAdding(false);
                        router.refresh();
                    }}
                />
            )}
        </main>
    );
}

/* ================== AddUnitSheet ================== */

type UITemplate = {
    id: string;
    name: string;
    roleTag: 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS' | null;
    isLeader?: boolean;
    factionId: string | null;
    stats: { hp: number; s: number; p: number; e: number; c: number; i: number; a: number; l: number };
    options: {
        id: string;
        costCaps: number;
        rating: number | null;
        weapon1Id: string;
        weapon1Name: string;
        weapon2Id: string | null;
        weapon2Name: string | null;
        weapon1: UIWeaponTemplate | null;
        weapon2: UIWeaponTemplate | null;
    }[];
};

type UIWeaponTemplateEffect = {
    effectId: string;
    valueInt: number | null;
    effect: { id: string; name: string; kind: 'WEAPON' | 'CRITICAL'; description: string; requiresValue: boolean };
};

type UIWeaponTemplateProfile = {
    id: string;
    order: number;
    typeOverride: string | null;
    testOverride: string | null;
    partsOverride: number | null;
    ratingDelta: number | null;
    effects: UIWeaponTemplateEffect[];
};

type UIWeaponTemplate = {
    id: string;
    name: string;
    imagePath: string | null;
    notes: string | null;
    baseType: string;
    baseTest: string;
    baseParts: number | null;
    baseRating: number | null;
    baseEffects: UIWeaponTemplateEffect[];
    profiles: UIWeaponTemplateProfile[];
};

type Paged<T> = { items: T[]; nextCursor: string | null };

function AddUnitSheet({
    armyId,
    factionId,
    subfactionId,
    onClose,
}: {
    armyId: string;
    factionId: string;
    subfactionId: string | null;
    onClose: () => void;
}) {
    const pageSize = 25;

    const [list, setList] = useState<UITemplate[]>([]);
    const [q, setQ] = useState('');
    const [roleTag, setRoleTag] = useState<'ALL' | 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS'>('ALL');

    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);

    const [selT, setSelT] = useState<string | null>(null);
    const [selO, setSelO] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const inFlightRef = useRef(false);

    function buildQs(nextCursor: string | null) {
        const qs = new URLSearchParams({
            factionId,
            limit: String(pageSize),
        });
        qs.set('expand', 'weapons');
        if (subfactionId) qs.set('subfactionId', subfactionId);
        if (q.trim()) qs.set('q', q.trim());
        if (roleTag !== 'ALL') qs.set('roleTag', roleTag);
        if (nextCursor) qs.set('cursor', nextCursor);
        return qs;
    }

    async function loadNext(reset = false) {
        if (inFlightRef.current) return;
        if (!hasMore && !reset) return;

        inFlightRef.current = true;
        setLoading(true);
        try {
            const nextCur = reset ? null : cursor;
            const res = await fetch(`/api/unit-templates?${buildQs(nextCur).toString()}`, { cache: 'no-store' });
            if (!res.ok) return;

            const json = (await res.json()) as Paged<UITemplate> | UITemplate[];

            const payload: Paged<UITemplate> = Array.isArray(json)
                ? { items: json, nextCursor: null }
                : json;

            setList((prev) => {
                const base = reset ? [] : prev;
                const byId = new Map<string, UITemplate>();
                for (const x of base) byId.set(x.id, x);
                for (const x of payload.items) byId.set(x.id, x);
                return [...byId.values()];
            });
            setCursor(payload.nextCursor);
            setHasMore(Boolean(payload.nextCursor));
        } finally {
            setLoading(false);
            inFlightRef.current = false;
        }
    }

    // initial + on filter change => reset
    useEffect(() => {
        setList([]);
        setCursor(null);
        setHasMore(true);
        setSelT(null);
        setSelO(null);
        void loadNext(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [factionId, subfactionId, roleTag, q]);

    // infinite scroll (IntersectionObserver)
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (first?.isIntersecting) void loadNext(false);
            },
            { root: null, rootMargin: '200px', threshold: 0 },
        );
        obs.observe(el);
        return () => obs.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sentinelRef.current, cursor, hasMore, loading]);

    const selected = list.find((t) => t.id === selT) ?? null;
    const can = Boolean(selT && selO);

    async function add() {
        if (!selected || !selO) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/armies/${armyId}/units`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unitTemplateId: selected.id, optionId: selO }),
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                notifyApiError(txt, 'Nie udało się dodać jednostki');
                return;
            }
            onClose();
        } finally {
            setBusy(false);
        }
    }

    const RoleChip = ({ k, label }: { k: typeof roleTag; label: string }) => (
        <button
            type="button"
            onClick={() => setRoleTag(k)}
            className={
                'h-9 rounded-full border px-3 text-xs font-medium ' +
                (roleTag === k ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-zinc-700 bg-zinc-950 text-zinc-300')
            }
        >
            {label}
        </button>
    );

    function formatEffectName(name: string, valueInt: number | null): string {
        if (valueInt == null) return name;
        const out = name.replace(/\(\s*X\s*\)/g, String(valueInt)).replace(/\bX\b/g, String(valueInt));
        if (out !== name) return out;
        return `${name} (${valueInt})`;
    }

    function WeaponDetails({ w }: { w: UIWeaponTemplate | null }) {
        if (!w) return <div className="text-[11px] text-zinc-500">Brak danych broni</div>;

        function EffectSpan({ e }: { e: UIWeaponTemplateEffect }) {
            const label = formatEffectName(e.effect.name, e.valueInt);
            return (
                <EffectTooltip
                    effectId={e.effect.id}
                    label={label}
                    className="cursor-help underline decoration-dotted underline-offset-2"
                />
            );
        }

        const baseTraits = (w.baseEffects ?? []).filter((e) => e.effect.kind === 'WEAPON');
        const baseCrits = (w.baseEffects ?? []).filter((e) => e.effect.kind === 'CRITICAL');

        const rows = [
            {
                kind: 'BASE' as const,
                key: 'BASE',
                type: w.baseType || '—',
                test: w.baseTest || '—',
                parts: w.baseParts,
                rating: w.baseRating,
                traits: baseTraits,
                crits: baseCrits,
            },
            ...(w.profiles ?? [])
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((p) => {
                    const pTraits = (p.effects ?? []).filter((e) => e.effect.kind === 'WEAPON');
                    const pCrits = (p.effects ?? []).filter((e) => e.effect.kind === 'CRITICAL');
                    return {
                        kind: 'PROFILE' as const,
                        key: p.id,
                        order: p.order,
                        type: p.typeOverride,
                        test: p.testOverride,
                        parts: p.partsOverride,
                        rating: p.ratingDelta,
                        traits: pTraits,
                        crits: pCrits,
                    };
                }),
        ];

        const renderEffects = (arr: UIWeaponTemplateEffect[]) => {
            if (!arr.length) return <span>—</span>;
            return (
                <ul className="list-disc pl-4 space-y-0.5">
                    {arr.map((t, i) => (
                        <li key={`${t.effectId}_${i}`}>
                            <EffectSpan e={t} />
                        </li>
                    ))}
                </ul>
            );
        };

        return (
            <div className="mt-1 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                {/* < 400px: tabela pionowa */}
                <div className="block min-[400px]:hidden">
                    {rows.map((r, idx) => {
                        const title = r.kind === 'BASE' ? 'Bazowe' : `Upgrade #${r.order ?? idx}`;
                        const fields: Array<[string, React.ReactNode]> = [
                            ['Wariant', <span key="v" className="font-semibold text-zinc-100">{title}</span>],
                            ['Type', r.type || '—'],
                            ['Test', r.test || '—'],
                            ['Traits', renderEffects(r.traits)],
                            ['Critical Effect', renderEffects(r.crits)],
                            ['Parts', r.parts != null ? String(r.parts) : '—'],
                            ['Rating', r.rating != null ? String(r.rating) : '—'],
                        ];
                        return (
                            <div key={r.key} className={idx === 0 ? '' : 'border-t border-zinc-800'}>
                                {fields.map(([label, value]) => (
                                    <div key={label} className="grid grid-cols-[36%_64%] border-t first:border-t-0 border-zinc-800">
                                        <div className="bg-zinc-900 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-300">{label}</div>
                                        <div className="px-2 py-1 text-sm whitespace-normal break-words text-zinc-200">{value}</div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>

                {/* ≥ 400px: tabela horyzontalna */}
                <div className="hidden min-[400px]:block overflow-x-auto">
                    <table className="w-full table-auto text-sm">
                        <thead>
                            <tr className="bg-teal-700/70 text-[11px] font-semibold uppercase tracking-wide text-teal-50">
                                <th className="px-2 py-1 text-left">Type</th>
                                <th className="px-2 py-1 text-left">Test</th>
                                <th className="px-2 py-1 text-left">Traits</th>
                                <th className="px-2 py-1 text-left">Critical Effect</th>
                                <th className="px-2 py-1 text-left">Parts</th>
                                <th className="px-2 py-1 text-left">Rating</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.key} className="border-t border-zinc-800 align-top bg-zinc-950">
                                    <td className="px-2 py-1 whitespace-normal break-words">{r.type || '—'}</td>
                                    <td className="px-2 py-1 whitespace-normal break-words">{r.test || '—'}</td>
                                    <td className="px-2 py-1 whitespace-normal break-words text-zinc-300">{renderEffects(r.traits)}</td>
                                    <td className="px-2 py-1 whitespace-normal break-words text-zinc-300">{renderEffects(r.crits)}</td>
                                    <td className="px-2 py-1">{r.parts != null ? r.parts : '—'}</td>
                                    <td className="px-2 py-1">{r.rating != null ? r.rating : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    function SpecialRow({ t }: { t: UITemplate }) {
        const s = t.stats;
        return (
            <div className="mt-2 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="grid grid-cols-8 bg-teal-700/70 text-teal-50 text-[11px] font-semibold tracking-widest">
                    {['S','P','E','C','I','A','L','HP'].map((h) => (
                        <div key={h} className="px-2 py-1 text-center">{h}</div>
                    ))}
                </div>
                <div className="grid grid-cols-8 bg-zinc-950 text-sm text-zinc-100">
                    <div className="px-2 py-1 text-center tabular-nums">{s.s}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.p}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.e}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.c}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.i}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.a}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.l}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.hp}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-20">
            <button aria-label="Zamknij" onClick={onClose} className="absolute inset-0 bg-black/60" />

            <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[92dvh] w-full max-w-screen-sm flex-col rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-xl">
                <div className="p-4 pb-3">
                    <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <div className="text-sm font-semibold">Dodaj jednostkę</div>
                            <div className="mt-0.5 text-[11px] text-zinc-400">Wybierz jednostkę i pakiet uzbrojenia.</div>
                        </div>
                        <button onClick={onClose} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                            Zamknij
                        </button>
                    </div>

                    <div className="mt-3">
                        <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                            <SearchOutlined className="text-zinc-400" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                                placeholder="Szukaj jednostki…"
                            />
                            {q && (
                                <button onClick={() => setQ('')} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 active:scale-95" aria-label="Wyczyść">
                                    <CloseOutlined />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <RoleChip k="ALL" label="Wszystkie" />
                        <RoleChip k="CHAMPION" label="Champion" />
                        <RoleChip k="GRUNT" label="Grunt" />
                        <RoleChip k="COMPANION" label="Companion" />
                        <RoleChip k="LEGENDS" label="Legends" />
                     </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-3">
                    <div className="grid gap-2">
                        {list.map((t) => {
                            const isSel = t.id === selT;
                            const initials = t.name
                                .split(' ')
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((x) => x[0]!.toUpperCase())
                                .join('');

                            return (
                                <div key={t.id} className={'rounded-2xl border ' + (isSel ? 'border-emerald-400 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900')}>
                                    <button
                                        onClick={() => {
                                            setSelT(t.id);
                                            setSelO(null);
                                        }}
                                        className="flex w-full items-center gap-3 p-3 text-left"
                                    >
                                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-sm font-semibold text-zinc-200">
                                            {initials || 'U'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium">{t.name}</div>
                                            <div className="mt-0.5 text-[11px] text-zinc-400">
                                                <span className="inline-flex flex-wrap items-center gap-1.5">
                                                    <span>{t.roleTag ? t.roleTag : '—'}</span>
                                                    {t.isLeader ? (
                                                        <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                                                            LEADER
                                                        </span>
                                                    ) : null}
                                                    <span>• {t.options.length} opcji</span>
                                                </span>
                                             </div>
                                             {isSel && <SpecialRow t={t} />}
                                         </div>
                                        <div className="text-xs text-zinc-400">{isSel ? <UpOutlined /> : <DownOutlined />}</div>
                                    </button>

                                    {isSel && (
                                        <div className="border-t border-zinc-800 bg-zinc-950 p-2">
                                            {t.options.map((o) => {
                                                const checked = selO === o.id;
                                                return (
                                                    <label
                                                        key={o.id}
                                                        className={
                                                            'mb-2 block rounded-xl border p-2 ' +
                                                            (checked ? 'border-emerald-400 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900')
                                                        }
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <input
                                                                type="radio"
                                                                name={`opt_${t.id}`}
                                                                checked={checked}
                                                                onChange={() => setSelO(o.id)}
                                                                className="mt-1"
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-sm font-medium">
                                                                    {o.weapon1Name}
                                                                    {o.weapon2Name ? ` + ${o.weapon2Name}` : ''}
                                                                </div>
                                                                <div className="mt-0.5 text-[11px] text-zinc-400">
                                                                    Cost {o.costCaps}
                                                                    {o.rating != null ? ` • Rating ${o.rating}` : ''}
                                                                </div>

                                                                <div className="mt-2 grid gap-2">
                                                                    <div>
                                                                        <div className="text-[11px] font-semibold text-zinc-300">Broń 1</div>
                                                                        <WeaponDetails w={o.weapon1} />
                                                                    </div>
                                                                    {o.weapon2Name && (
                                                                        <div>
                                                                            <div className="text-[11px] font-semibold text-zinc-300">Broń 2</div>
                                                                            <WeaponDetails w={o.weapon2} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}

                                            {t.options.length === 0 && <div className="text-sm text-zinc-500">Brak opcji uzbrojenia.</div>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {list.length === 0 && !loading && <div className="text-sm text-zinc-500">Brak wyników.</div>}
                    </div>

                    <div ref={sentinelRef} className="h-12" />

                    {loading && <div className="py-3 text-center text-xs text-zinc-400">Ładowanie…</div>}
                    {!hasMore && list.length > 0 && <div className="py-3 text-center text-xs text-zinc-500">To wszystko.</div>}
                </div>

                <div className="border-t border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="h-11 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-300"
                        >
                            Anuluj
                        </button>
                        <button
                            onClick={() => void add()}
                            disabled={!can || busy}
                            className="h-11 flex-1 rounded-2xl bg-emerald-500 text-sm font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {busy ? 'Dodawanie…' : 'Dodaj'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
