'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Kind = 'caps' | 'parts' | 'reach' | 'exp';

/* ==== typy broni zgodne z logiką override ==== */
type EffectKind = 'WEAPON' | 'CRITICAL';
type UIEffect = { id: string; name: string; valueInt: number | null; kind: EffectKind };
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
};

type RoleFilter = 'ALL' | 'CHAMPION' | 'GRUNT' | 'COMPANION';
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

export default function ArmyDashboardClient({
                                                armyId,
                                                armyName,
                                                tier,
                                                factionId,                 // <<<<<< DODANE
                                                factionName,
                                                resources,
                                                units,
                                                rating,
                                            }: {
    armyId: string;
    armyName: string;
    tier: number;
    factionId: string;         // <<<<<< DODANE
    factionName: string;
    resources: Record<Kind, number>;
    units: UnitListItem[];
    rating: number;
}) {
    const router = useRouter();
    const [totals, setTotals] = useState(resources);
    const [busy, setBusy] = useState<Kind | null>(null);
    const [adding, setAdding] = useState(false);
    const [filter, setFilter] = useState<RoleFilter>('ALL');
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
            alert('Nie udało się zapisać zasobów');
        } finally {
            setBusy(null);
        }
    }

    async function deleteUnit(unitId: string) {
        const ok = typeof window !== 'undefined' ? window.confirm('Na pewno usunąć tę jednostkę z armii?') : false;
        if (!ok) return;
        setDeletingId(unitId);
        try {
            const res = await fetch(`/api/armies/${armyId}/units/${unitId}`, { method: 'DELETE' });
            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                throw new Error(txt || 'Request failed');
            }
            router.refresh();
        } catch {
            alert('Nie udało się usunąć jednostki');
        } finally {
            setDeletingId(null);
        }
    }

    function n(v: string, def = 0) {
        const x = Number(v);
        return Number.isFinite(x) ? x : def;
    }

    const groups = useMemo(() => {
        const champion: UnitListItem[] = [];
        const grunt: UnitListItem[] = [];
        const companion: UnitListItem[] = [];
        for (const u of units) {
            const tag = (u.roleTag ?? 'GRUNT').toUpperCase();
            if (tag.includes('CHAMPION') || tag.includes('LEADER')) champion.push(u);
            else if (tag.includes('COMPANION')) companion.push(u);
            else grunt.push(u);
        }
        return { champion, grunt, companion };
    }, [units]);

    const filtered = useMemo(() => {
        if (filter === 'ALL') return units;
        if (filter === 'CHAMPION') return groups.champion;
        if (filter === 'COMPANION') return groups.companion;
        return groups.grunt;
    }, [filter, units, groups]);

    /* ---------- SPECIAL (kompakt) ---------- */
    function SpecialCompact({
                                base,
                                bonus,
                            }: {
        base: UnitListItem['base'];
        bonus: UnitListItem['bonus'];
    }) {
        const HEAD = ['S', 'P', 'E', 'C', 'I', 'A', 'L', '♥'] as const;
        const sign = (x: number) => (x > 0 ? `+${x}` : `${x}`);

        return (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <div className="grid grid-cols-8 bg-teal-700/70 text-teal-50 text-[11px] font-semibold tracking-widest">
                    {HEAD.map((h) => (
                        <div key={h} className="px-2 py-1 text-center">
                            {h === '♥' ? 'HP' : h}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-8 bg-zinc-950 text-sm text-zinc-100">
                    {HEAD.map((h) => {
                        const baseVal = h === '♥' ? base.hp : base[h as Exclude<typeof h, '♥'>];
                        const finalVal =
                            h === '♥' ? base.hp + bonus.HP : base[h as Exclude<typeof h, '♥'>] + bonus[h as Exclude<typeof h, '♥'>];
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
        const traitsText =
            [...agg.values()]
                .filter((e) => e.kind === 'WEAPON')
                .map((e) => formatEffect(e.name, e.valueInt))
                .join(', ') || '—';
        const critsText =
            [...agg.values()]
                .filter((e) => e.kind === 'CRITICAL')
                .map((e) => formatEffect(e.name, e.valueInt))
                .join(', ') || '—';

        return { type, test, traitsText, critsText };
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
        const [wounds, setWounds] = useState(u.wounds);
        const [absent, setAbsent] = useState(!u.present);

        async function savePresence(nextPresent: boolean) {
            setAbsent(!nextPresent);
            await fetch(`/api/units/${u.id}/presence`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ present: nextPresent }),
            }).catch(() => {});
        }

        async function saveWounds(next: number) {
            setWounds(next);
            await fetch(`/api/units/${u.id}/wounds`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wounds: next }),
            }).catch(() => {});
        }

        const maxHp = u.base.hp + u.bonus.HP;

        return (
            <Link href={`/army/${aId}/unit/${u.id}`} className="block max-w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center justify-between">
                    <div className="font-medium">{u.templateName}</div>
                    <div className="flex items-center gap-2">
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
                                    {([
                                        ['Weapon', w.name],
                                        ['Type', d.type],
                                        ['Test', d.test],
                                        ['Traits', d.traitsText],
                                        ['Critical Effect', d.critsText],
                                    ] as const).map(([label, value]) => (
                                        <div key={label} className="grid grid-cols-[36%_64%] border-t first:border-t-0 border-zinc-800">
                                            <div className="bg-teal-700/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-50">
                                                {label}
                                            </div>
                                            <div className="px-2 py-1 text-sm whitespace-normal break-words">{value}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="hidden min-[400px]:block overflow-x-auto">
                                    <table className="w-full table-auto text-sm">
                                        <thead>
                                        <tr className="bg-teal-700/70 text-[11px] font-semibold uppercase tracking-wide text-teal-50">
                                            <th className="px-2 py-1 text-left">Weapon</th>
                                            <th className="px-2 py-1 text-left">Type</th>
                                            <th className="px-2 py-1 text-left">Test</th>
                                            <th className="px-2 py-1 text-left">Traits</th>
                                            <th className="px-2 py-1 text-left">Critical Effect</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        <tr className="border-t border-zinc-800 align-top">
                                            <td className="px-2 py-1 whitespace-normal break-words">{w.name}</td>
                                            <td className="px-2 py-1 whitespace-normal break-words">{d.type}</td>
                                            <td className="px-2 py-1 whitespace-normal break-words">{d.test}</td>
                                            <td className="px-2 py-1 whitespace-normal break-words text-zinc-300">{d.traitsText}</td>
                                            <td className="px-2 py-1 whitespace-normal break-words text-zinc-300">{d.critsText}</td>
                                        </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-2 flex items-center justify-end gap-3">
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

                    <div
                        className="flex items-center gap-1 text-xs"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <span>Wounds</span>
                        <input
                            inputMode="numeric"
                            value={wounds}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isFinite(v)) void saveWounds(Math.max(0, Math.min(maxHp, v)));
                            }}
                            className="w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-right"
                        />
                        <span className="text-[11px] text-zinc-500">/ {maxHp}</span>
                    </div>
                </div>
            </Link>
        );
    }

    /* ====== Ikony ====== */
    const ICON: Record<Kind, string> = {
        caps: '🪙',
        parts: '🧩',
        exp: '⭐',
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
            alert('Nie udało się zapisać hazardu');
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
            alert('Nie udało się dodać facility');
        } finally {
            setAddingFac(false);
        }
    }

    async function deleteFacility(id: string) {
        if (!confirm('Usunąć to facility?')) return;
        setDeletingFacId(id);
        try {
            const res = await fetch(`/api/armies/${armyId}/home-turf/facilities/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            setFacilities((f) => f.filter((x) => x.id !== id));
        } catch {
            alert('Nie udało się usunąć facility');
        } finally {
            setDeletingFacId(null);
        }
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
            alert('Nie udało się zapisać postępu celu');
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
                    <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
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
                    <div className="mt-3 flex gap-2">
                        {(['ALL', 'CHAMPION', 'GRUNT', 'COMPANION'] as RoleFilter[]).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={
                                    'h-9 flex-1 rounded-xl border text-xs font-medium ' +
                                    (filter === f ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                                }
                            >
                                {f}
                            </button>
                        ))}
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
                <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
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
                                        className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-center text-lg"
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
                <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
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
                <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="text-sm font-medium">Home Turf</div>

                    {/* Hazard */}
                    <div className="mt-3">
                        <label className="text-xs text-zinc-400">Hazard</label>
                        <textarea
                            value={hazard}
                            onChange={(e) => setHazard(e.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
                                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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

            {adding && <AddUnitSheet armyId={armyId} factionId={factionId} onClose={() => { setAdding(false); router.refresh(); }} />}
        </main>
    );
}

/* ================== AddUnitSheet ================== */

type UITemplate = {
    id: string;
    name: string;
    roleTag: string | null;
    factionId: string | null; // <<<<<< DODANE: potrzebne do filtra
    options: {
        id: string;
        costCaps: number;
        rating: number | null;
        weapon1Id: string;
        weapon1Name: string;
        weapon2Id: string | null;
        weapon2Name: string | null;
    }[];
};

function AddUnitSheet({ armyId, factionId, onClose }: { armyId: string; factionId: string; onClose: () => void }) {
    const [list, setList] = useState<UITemplate[]>([]);
    const [q, setQ] = useState('');
    const [selT, setSelT] = useState<string | null>(null);
    const [selO, setSelO] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch(`/api/unit-templates?factionId=${encodeURIComponent(factionId)}`, { cache: 'no-store' });
                if (res.ok) setList((await res.json()) as UITemplate[]);
            } catch {
                // noop
            }
        })();
    }, [factionId]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        return s ? list.filter(t => t.name.toLowerCase().includes(s)) : list;
    }, [q, list]);

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
                alert('Nie udało się dodać jednostki: ' + txt);
                return;
            }
            onClose();
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-20">
            <button aria-label="Zamknij" onClick={onClose} className="absolute inset-0 bg-black/60" />
            <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-screen-sm rounded-t-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
                <div className="text-sm font-semibold">Dodaj jednostkę</div>

                <label className="mt-2 block">
                    <span className="text-xs text-zinc-400">Szukaj</span>
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                        placeholder="np. Aspirant"
                    />
                </label>

                <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto pr-1">
                    {filtered.map((t) => {
                        const isSel = t.id === selT;
                        return (
                            <div key={t.id} className={'rounded-xl border ' + (isSel ? 'border-emerald-400' : 'border-zinc-800')}>
                                <button
                                    onClick={() => {
                                        setSelT(t.id);
                                        setSelO(null);
                                    }}
                                    className="flex w-full items-center justify-between bg-zinc-950 p-3 text-left"
                                >
                                    <div className="font-medium">{t.name}</div>
                                    <div className="text-[10px] text-zinc-400">{t.options.length} opcji</div>
                                </button>
                                {isSel && (
                                    <div className="border-t border-zinc-800 bg-zinc-900 p-2">
                                        {t.options.map((o) => {
                                            const checked = selO === o.id;
                                            return (
                                                <label
                                                    key={o.id}
                                                    className={
                                                        'mb-2 block rounded-lg border p-2 ' +
                                                        (checked ? 'border-emerald-400 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950')
                                                    }
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <input type="radio" name={`opt_${t.id}`} checked={checked} onChange={() => setSelO(o.id)} />
                                                            <div className="text-sm">
                                                                <div className="font-medium">
                                                                    {o.weapon1Name}
                                                                    {o.weapon2Name ? ` + ${o.weapon2Name}` : ''}
                                                                </div>
                                                                <div className="text-[11px] text-zinc-400">
                                                                    Cost {o.costCaps}
                                                                    {o.rating != null ? ` • Rating ${o.rating}` : ''}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filtered.length === 0 && <div className="text-sm text-zinc-500">Brak wyników</div>}
                </div>

                <div className="mt-3 flex gap-2">
                    <button onClick={onClose} className="h-11 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-300">
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
    );
}
