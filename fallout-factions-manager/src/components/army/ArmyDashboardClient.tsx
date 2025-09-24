// src/components/army/ArmyDashboardClient.tsx
'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Kind = 'caps' | 'parts' | 'reach';

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
    weapons: { name: string; type: string; test: string; traits: string[]; crits: string[] }[];
};

type RoleFilter = 'ALL' | 'CHAMPION' | 'GRUNT' | 'COMPANION';

export default function ArmyDashboardClient({
                                                armyId,
                                                armyName,
                                                tier,
                                                factionName,
                                                resources,
                                                units,
                                                rating,
                                            }: {
    armyId: string;
    armyName: string;
    tier: number;
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

    /* ---------- wspólne klocki UI ---------- */

    function StatPill({ label, value, delta }: { label: string; value: number; delta: number }) {
        const boosted = delta !== 0;
        return (
            <div className="flex h-16 w-[64px] flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950">
                <div className="text-[10px] font-semibold tracking-widest text-teal-200">{label}</div>
                <div className="mt-0.5 tabular-nums text-sm text-zinc-100">{value}</div>
                <div className="mt-0.5 min-h-[14px] text-[10px] leading-none">
                    {boosted ? <span className="rounded bg-emerald-600/20 px-1 text-emerald-300">+{delta}</span> : <span className="opacity-0">+0</span>}
                </div>
            </div>
        );
    }

    function StatInlineRow({
                               base,
                               bonus,
                               maxHp,
                           }: {
        base: UnitListItem['base'];
        bonus: UnitListItem['bonus'];
        maxHp: number;
    }) {
        return (
            <div className="overflow-x-auto">
                <div className="flex min-w-[560px] gap-1">
                    {(['S', 'P', 'E', 'C', 'I', 'A', 'L'] as const).map((k) => (
                        <StatPill key={k} label={k} value={base[k] + bonus[k]} delta={bonus[k]} />
                    ))}
                    <StatPill label="HP" value={maxHp} delta={bonus.HP} />
                </div>
            </div>
        );
    }

    function UnitRow({ u, armyId: aId }: { u: UnitListItem; armyId: string }) {
        const [wounds, setWounds] = useState(u.wounds);
        const [absent, setAbsent] = useState(!u.present);

        async function savePresence(nextPresent: boolean) {
            setAbsent(!nextPresent); // optimistic
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
                    <div className="text-xs text-zinc-400">
                        Rating <span className="font-semibold text-zinc-200">{u.rating}</span>
                    </div>
                </div>

                {/* SPECIAL — jedna linia, scrollek w środku karty */}
                <div className="mt-2">
                    <StatInlineRow base={u.base} bonus={u.bonus} maxHp={maxHp} />
                </div>

                {/* Broń — tabela w scrolldivie */}
                <div className="mt-2 grid gap-2">
                    {u.weapons.map((w, idx) => (
                        <div key={idx} className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
                            <table className="min-w-[560px] w-full text-sm">
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
                                <tr className="border-t border-zinc-800">
                                    <td className="px-2 py-1">{w.name}</td>
                                    <td className="px-2 py-1">{w.type || '—'}</td>
                                    <td className="px-2 py-1">{w.test || '—'}</td>
                                    <td className="px-2 py-1 text-zinc-300">{w.traits.join(', ') || '—'}</td>
                                    <td className="px-2 py-1 text-zinc-300">{w.crits.join(', ') || '—'}</td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                {/* Kontrolki — bez nawigacji w głąb po kliknięciu */}
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

            {/* ZASOBY */}
            <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium">Zasoby</div>
                    <button onClick={() => setAdding(true)} className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs">
                        Dodaj jednostkę
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {(['caps', 'parts', 'reach'] as const).map((k) => (
                        <div key={k} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                            <div className="text-[10px] uppercase text-zinc-400">{k}</div>
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

            {/* JEDNOSTKI */}
            <section className="mt-4">
                <div className="text-sm font-medium">Jednostki</div>
                <div className="mt-2 grid gap-2">
                    {filtered.map((u) => (
                        <UnitRow key={u.id} u={u} armyId={armyId} />
                    ))}
                    {filtered.length === 0 && <div className="text-sm text-zinc-500">Brak jednostek dla filtra</div>}
                </div>
            </section>

            {adding && <AddUnitSheet armyId={armyId} onClose={() => { setAdding(false); router.refresh(); }} />}
        </main>
    );
}

/* ================== AddUnitSheet ================== */

type UITemplate = {
    id: string;
    name: string;
    roleTag: string | null;
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

function AddUnitSheet({ armyId, onClose }: { armyId: string; onClose: () => void }) {
    const [list, setList] = useState<UITemplate[]>([]);
    const [q, setQ] = useState('');
    const [selT, setSelT] = useState<string | null>(null);
    const [selO, setSelO] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch('/api/unit-templates', { cache: 'no-store' });
                if (res.ok) setList((await res.json()) as UITemplate[]);
            } catch {
                // noop
            }
        })();
    }, []);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return list;
        return list.filter((t) => t.name.toLowerCase().includes(s));
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
