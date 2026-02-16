'use client';

import { useRouter } from 'next/navigation';
import { notifyApiError } from '@/lib/ui/notify';
import { useMemo, useState, useEffect } from 'react';
import { PlusOutlined } from '@ant-design/icons';

type FactionDTO = {
    id: string;
    name: string;
    limits: { tag: string; tier1: number | null; tier2: number | null; tier3: number | null }[];
    goalSets: {
        id: string;
        name: string;
        goals: { tier: 1 | 2 | 3; description: string; target: number; order: number }[];
    }[];
};

type SubfactionDTO = { id: string; name: string; factionId: string };

export function CreateArmySheet(props: { factions: FactionDTO[] }) {
    return <CreateArmySheetDefault {...props} />;
}

export default function CreateArmySheetDefault({ factions }: { factions: FactionDTO[] }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="ff-btn ff-btn-primary ff-btn-icon-mobile"
                title="Add army"
                aria-label="Add army"
            >
                <PlusOutlined className="ff-btn-icon" />
                <span className="ff-btn-label">Add army</span>
            </button>
            {open && <Sheet factions={factions} onClose={() => setOpen(false)} />}
        </>
    );
}

type Step = 'INFO' | 'FACTION';

function Sheet({ factions, onClose }: { factions: FactionDTO[]; onClose: () => void }) {
    const router = useRouter();
    const [step, setStep] = useState<Step>('INFO');

    const [q, setQ] = useState('');
    const [name, setName] = useState('');
    const [tier, setTier] = useState<1 | 2 | 3>(1);

    const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
    const [selectedSubfactionId, setSelectedSubfactionId] = useState<string | null>(null);
    const [subfactions, setSubfactions] = useState<SubfactionDTO[]>([]);
    const [subBusy, setSubBusy] = useState(false);

    const [selectedGoalSetId, setSelectedGoalSetId] = useState<string | null>(null);
    const [expandedGoalSetId, setExpandedGoalSetId] = useState<string | null>(null);

    const selectedFaction = useMemo(
        () => factions.find((f) => f.id === selectedFactionId) ?? null,
        [selectedFactionId, factions]
    );

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return factions;
        return factions.filter((f) => f.name.toLowerCase().includes(s));
    }, [q, factions]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!selectedFactionId) {
                setSubfactions([]);
                setSelectedSubfactionId(null);
                return;
            }
            setSubBusy(true);
            try {
                const res = await fetch(`/api/subfactions?factionId=${encodeURIComponent(selectedFactionId)}`, {
                    cache: 'no-store',
                });
                if (!res.ok) throw new Error(await res.text());
                const rows = (await res.json()) as SubfactionDTO[];
                if (!cancelled) {
                    setSubfactions(rows);
                    // default: no subfaction (pure faction)
                    setSelectedSubfactionId(null);
                }
            } catch {
                if (!cancelled) {
                    setSubfactions([]);
                    setSelectedSubfactionId(null);
                }
            } finally {
                if (!cancelled) setSubBusy(false);
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [selectedFactionId]);

    // requires name + faction + goal set; subfaction is optional
    const can = name.trim().length >= 3 && !!selectedFaction && !!selectedGoalSetId;

    async function createArmy() {
        const res = await fetch('/api/armies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name.trim(),
                factionId: selectedFaction!.id,
                tier,
                goalSetId: selectedGoalSetId,
                subfactionId: selectedSubfactionId,
            }),
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            notifyApiError(txt, 'Failed to create army');
            return;
        }
        const { id } = (await res.json()) as { id: string };
        onClose();
        router.push(`/army/${id}`);
    }

    return (
        <div className="fixed inset-0 z-20">
            <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
            <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-screen-sm rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-xl h-[90dvh] flex flex-col">
                <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-700" />

                {/* header */}
                <header className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 pt-2 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">New crew</div>
                        <button onClick={onClose} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                            Close
                        </button>
                    </div>

                    {/* stepper */}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {([
                            ['INFO', 'Info'] as const,
                            ['FACTION', 'Faction'] as const,
                        ]).map(([k, label]) => (
                            <button
                                key={k}
                                onClick={() => setStep(k)}
                                className={
                                    'h-9 rounded-xl border text-xs font-medium ' +
                                    (step === k
                                        ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                                        : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                                }
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* summary row */}
                    <div className="mt-2 flex items-center gap-2 overflow-x-auto text-xs text-zinc-400 no-scrollbar">
            <span>
              Name: <span className="text-zinc-200 font-medium">{name.trim() || '-'}</span>
            </span>
                        <span>|</span>
                        <span>
              Tier: <span className="text-zinc-200 font-medium">T{tier}</span>
            </span>
                        <span>|</span>
                        <span>
              Faction: <span className="text-zinc-200 font-medium">{selectedFaction?.name ?? '-'}</span>
            </span>
                        <span>|</span>
                        <span>
              Subfaction: <span className="text-zinc-200 font-medium">{subfactions.find(s => s.id === selectedSubfactionId)?.name ?? 'none'}</span>
            </span>
                    </div>
                </header>

                {/* content */}
                <div className="vault-scrollbar flex-1 overflow-y-auto px-4 pb-24 pt-3">
                    {step === 'INFO' && (
                        <InfoStep name={name} tier={tier} onName={setName} onTier={(t) => setTier(t)} />
                    )}

                    {step === 'FACTION' && (
                        <>
                            <FactionStep
                                factions={filtered}
                                q={q}
                                onSearch={setQ}
                                selectedFactionId={selectedFactionId}
                                onSelectFaction={(fid) => {
                                    setSelectedFactionId(fid);
                                    const first = factions.find((f) => f.id === fid)?.goalSets[0]?.id ?? null;
                                    setSelectedGoalSetId(first);
                                    setExpandedGoalSetId(null);
                                }}
                                selectedGoalSetId={selectedGoalSetId}
                                onSelectGoalSet={setSelectedGoalSetId}
                                expandedGoalSetId={expandedGoalSetId}
                                setExpandedGoalSetId={setExpandedGoalSetId}
                            />

                            {/* Subfaction (optional) */}
                            {selectedFaction && (
                                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                                    <div className="text-xs font-semibold text-zinc-200">Subfaction (optional)</div>
                                    <div className="mt-1 text-[11px] text-zinc-400">
                                        No selection = pure faction. Subfactions can allow or block access to units and loadouts.
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSelectedSubfactionId(null)}
                                            className={
                                                'h-9 rounded-xl border px-3 text-xs font-medium ' +
                                                (selectedSubfactionId == null
                                                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                                                    : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                                            }
                                        >
                                            No subfaction
                                        </button>
                                        {subfactions.map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => setSelectedSubfactionId(s.id)}
                                                className={
                                                    'h-9 rounded-xl border px-3 text-xs font-medium ' +
                                                    (selectedSubfactionId === s.id
                                                        ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                                                        : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                                                }
                                            >
                                                {s.name}
                                            </button>
                                        ))}
                                    </div>

                                    {subBusy && (
                                        <div className="mt-2 text-[11px] text-zinc-500">Loading subfaction list...</div>
                                    )}
                                    {!subBusy && subfactions.length === 0 && (
                                        <div className="mt-2 text-[11px] text-zinc-500">No subfactions defined for this faction.</div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* footer */}
                <footer className="sticky bottom-0 z-10 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 p-3">
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="h-11 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-300 active:scale-[0.99]"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={!can}
                            onClick={() => void createArmy()}
                            className="h-11 flex-1 rounded-2xl bg-emerald-500 text-sm font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
                        >
                            Create
                        </button>
                    </div>
                    {!selectedGoalSetId && (
                        <div className="mt-2 text-center text-[11px] text-amber-300">
                            Select a goal set for the selected faction.
                        </div>
                    )}
                </footer>
            </div>
        </div>
    );
}

/* ----- KROK 1 ----- */
function InfoStep({
                      name,
                      tier,
                      onName,
                      onTier,
                  }: {
    name: string;
    tier: 1 | 2 | 3;
    onName: (v: string) => void;
    onTier: (t: 1 | 2 | 3) => void;
}) {
    return (
        <div className="grid gap-3">
            <label className="grid gap-1">
                <span className="text-xs text-zinc-400">Name</span>
                <input
                    autoFocus
                    value={name}
                    onChange={(e) => onName(e.target.value)}
                    placeholder="e.g. Alpha Squad"
                    className="vault-input px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
            </label>

            <div className="grid gap-1">
                <span className="text-xs text-zinc-400">Tier</span>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {[1, 2, 3].map((t) => (
                        <button
                            key={t}
                            onClick={() => onTier(t as 1 | 2 | 3)}
                            className={
                                'h-10 min-w-[88px] rounded-xl border px-3 text-sm font-medium shrink-0 ' +
                                (tier === t
                                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                                    : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                            }
                        >
                            Tier {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
                In the next step, choose a faction and a goal set.
            </div>
        </div>
    );
}

/* ----- KROK 2 ----- */
function FactionStep({
                         factions,
                         q,
                         onSearch,
                         selectedFactionId,
                         onSelectFaction,
                         selectedGoalSetId,
                         onSelectGoalSet,
                         expandedGoalSetId,
                         setExpandedGoalSetId,
                     }: {
    factions: FactionDTO[];
    q: string;
    onSearch: (v: string) => void;
    selectedFactionId: string | null;
    onSelectFaction: (id: string) => void;
    selectedGoalSetId: string | null;
    onSelectGoalSet: (id: string) => void;
    expandedGoalSetId: string | null;
    setExpandedGoalSetId: (id: string | null) => void;
}) {
    return (
        <div className="grid gap-3">
            <label className="grid gap-1">
                <span className="text-xs text-zinc-400">Faction</span>
                <input
                    value={q}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder="Search faction"
                    className="vault-input px-3 py-2 text-sm outline-none"
                />
            </label>

            <div className="grid gap-2">
                {factions.map((f) => {
                    const isSelected = f.id === selectedFactionId;
                    return (
                        <div
                            key={f.id}
                            className={
                                'rounded-xl border overflow-hidden ' +
                                (isSelected ? 'border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]' : 'border-zinc-800')
                            }
                        >
                            <button
                                onClick={() => {
                                    onSelectFaction(f.id);
                                }}
                                className="flex w-full items-center justify-between bg-zinc-950 p-3 text-left"
                            >
                                <div className="flex items-center gap-2">
                  <span
                      className={
                          'inline-block h-2.5 w-2.5 rounded-full ring-2 ' +
                          (isSelected ? 'bg-emerald-400 ring-emerald-300' : 'bg-zinc-600 ring-zinc-500')
                      }
                      aria-hidden
                  />
                                    <div className="font-medium">{f.name}</div>
                                </div>
                                <div className="text-[10px] text-zinc-400">
                                    {f.limits.length} limit(s) | {f.goalSets.length} set(s)
                                </div>
                            </button>

                            <div className="border-t border-zinc-800 bg-zinc-900 p-2">
                                {/* limits - compact chips */}
                                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                                    {f.limits.map((l) => (
                                        <span
                                            key={l.tag}
                                            className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px]"
                                            title={`${l.tag} ${[l.tier1, l.tier2, l.tier3].map((v) => v ?? '-').join('/')}`}
                                        >
                      <span className="font-medium">{l.tag}</span>
                      <span className="text-zinc-500">
                        {[l.tier1, l.tier2, l.tier3].map((v) => v ?? '-').join('/')}
                      </span>
                    </span>
                                    ))}
                                    {f.limits.length === 0 && <span className="text-[11px] text-zinc-500">no limits</span>}
                                </div>

                                {/* task sets - only for selected faction */}
                                {isSelected && (
                                    <div className="mt-2 grid gap-2">
                                        {f.goalSets.map((gs) => {
                                            const checked = selectedGoalSetId === gs.id;
                                            const expanded = expandedGoalSetId === gs.id;
                                            const counts = [1, 2, 3].map((t) => gs.goals.filter((g) => g.tier === t).length);

                                            return (
                                                <div
                                                    key={gs.id}
                                                    className={
                                                        'rounded-lg border ' +
                                                        (checked ? 'border-emerald-400 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950')
                                                    }
                                                >
                                                    <div className="flex items-center justify-between p-2">
                                                        <label className="flex items-center gap-2">
                                                            <input
                                                                type="radio"
                                                                name={`goalset_${f.id}`}
                                                                checked={checked}
                                                                onChange={() => onSelectGoalSet(gs.id)}
                                                            />
                                                            <div className="text-sm font-medium">{gs.name}</div>
                                                        </label>

                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-zinc-500">T1/T2/T3: {counts.join('/')}</span>
                                                            <button
                                                                onClick={() => setExpandedGoalSetId(expanded ? null : gs.id)}
                                                                className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200"
                                                            >
                                                                {expanded ? 'Hide goals' : 'Show goals'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {expanded && (
                                                        <div className="border-t border-zinc-800 p-2">
                                                            {[1, 2, 3].map((t) => {
                                                                const tierGoals = gs.goals
                                                                    .filter((g) => g.tier === (t as 1 | 2 | 3))
                                                                    .sort((a, b) => a.order - b.order);
                                                                if (tierGoals.length === 0) return null;
                                                                return (
                                                                    <div key={t} className="mt-2 first:mt-0">
                                                                        <div className="text-[10px] text-zinc-400">TIER {t}</div>
                                                                        <ul className="ml-4 list-disc">
                                                                            {tierGoals.map((g, i) => (
                                                                                <li key={i} className="text-[11px] text-zinc-300">
                                                                                    {g.description}{' '}
                                                                                    <span className="text-zinc-500">(x{g.target})</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {f.goalSets.length === 0 && <div className="text-sm text-zinc-500 px-2 pb-2">no sets</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {factions.length === 0 && <div className="text-sm text-zinc-500">No results</div>}
            </div>
        </div>
    );
}
