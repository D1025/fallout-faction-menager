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

function Sheet({ factions, onClose }: { factions: FactionDTO[]; onClose: () => void }) {
    const router = useRouter();

    const [q, setQ] = useState('');
    const [name, setName] = useState('');
    const [tier, setTier] = useState<1 | 2 | 3>(1);
    const [factionPickerOpen, setFactionPickerOpen] = useState(false);

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
        <div className="fixed inset-0 z-20 flex items-end justify-center">
            <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
            <div className="relative mx-auto flex h-[88dvh] w-full max-w-screen-sm flex-col rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-xl sm:h-[90dvh]">
                <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-700" />

                {/* header */}
                <header className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 pt-2 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">New crew</div>
                        <button onClick={onClose} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                            Close
                        </button>
                    </div>
                </header>

                {/* content */}
                <div className="vault-scrollbar flex-1 overflow-y-auto px-4 pb-24 pt-3">
                    <InfoStep name={name} tier={tier} onName={setName} onTier={(t) => setTier(t)} />

                    <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-xs font-semibold text-zinc-200">Faction</div>
                                <div className="mt-1 text-sm text-zinc-300">
                                    {selectedFaction?.name ?? 'No faction selected'}
                                </div>
                            </div>
                            <button
                                onClick={() => setFactionPickerOpen(true)}
                                className="h-9 rounded-xl border border-emerald-400/70 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300"
                            >
                                {selectedFaction ? 'Change faction' : 'Choose faction'}
                            </button>
                        </div>

                        {!selectedFaction && (
                            <div className="mt-2 text-[11px] text-zinc-400">
                                Choose a faction to unlock quest line and subfaction modules.
                            </div>
                        )}

                        {selectedFaction && (
                            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-2">
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                    {selectedFaction.limits.map((limit) => (
                                        <span
                                            key={limit.tag}
                                            className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-300"
                                        >
                                            <span className="text-zinc-400">{formatLimitTag(limit.tag)}:</span>
                                            <span className="font-semibold text-zinc-100">{tierLimitValue(limit, tier)}</span>
                                        </span>
                                    ))}
                                </div>
                                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Crew limits
                                </div>
                                <LimitGrid limits={selectedFaction.limits} />
                            </div>
                        )}
                    </section>

                    {selectedFaction && (
                        <>
                            <GoalSetStep
                                faction={selectedFaction}
                                selectedGoalSetId={selectedGoalSetId}
                                onSelectGoalSet={setSelectedGoalSetId}
                                expandedGoalSetId={expandedGoalSetId}
                                setExpandedGoalSetId={setExpandedGoalSetId}
                            />

                            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                                <div className="text-xs font-semibold text-zinc-200">Subfaction (optional)</div>
                                <div className="mt-1 text-[11px] text-zinc-400">
                                    No selection means pure faction profile.
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
                        </>
                    )}
                </div>

                {/* footer */}
                <footer className="sticky bottom-0 z-10 border-t border-zinc-800 bg-zinc-900/95 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur">
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
                    {selectedFaction && !selectedGoalSetId && (
                        <div className="mt-2 text-center text-[11px] text-amber-300">
                            Select a quest line for the selected faction.
                        </div>
                    )}
                </footer>

                {factionPickerOpen && (
                    <FactionPickerOverlay
                        factions={filtered}
                        tier={tier}
                        q={q}
                        onSearch={setQ}
                        selectedFactionId={selectedFactionId}
                        onClose={() => setFactionPickerOpen(false)}
                        onSelectFaction={(fid) => {
                            setSelectedFactionId(fid);
                            const first = factions.find((f) => f.id === fid)?.goalSets[0]?.id ?? null;
                            setSelectedGoalSetId(first);
                            setExpandedGoalSetId(null);
                            setFactionPickerOpen(false);
                        }}
                    />
                )}
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
                Choose a faction below. Quest line and subfaction modules unlock after selecting faction.
            </div>
        </div>
    );
}

function formatLimitTag(tag: string) {
    return tag
        .toLowerCase()
        .split(' ')
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
        .join(' ');
}

function tierLimitValue(
    limit: FactionDTO['limits'][number],
    tier: 1 | 2 | 3
) {
    if (tier === 1) return limit.tier1 ?? '-';
    if (tier === 2) return limit.tier2 ?? '-';
    return limit.tier3 ?? '-';
}

function LimitGrid({
                       limits,
                   }: {
    limits: FactionDTO['limits'];
}) {
    return (
        <div className="grid gap-1.5">
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg bg-zinc-950 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500">
                <span>Limit</span>
                <span>T1</span>
                <span>T2</span>
                <span>T3</span>
            </div>
            {limits.map((l) => (
                <div key={l.tag} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px]">
                    <span className="text-zinc-200">{formatLimitTag(l.tag)}</span>
                    <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-zinc-300">{l.tier1 ?? '-'}</span>
                    <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-zinc-300">{l.tier2 ?? '-'}</span>
                    <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-zinc-300">{l.tier3 ?? '-'}</span>
                </div>
            ))}
            {limits.length === 0 && <div className="text-[11px] text-zinc-500">No limits defined.</div>}
        </div>
    );
}

function GoalSetStep({
                         faction,
                         selectedGoalSetId,
                         onSelectGoalSet,
                         expandedGoalSetId,
                         setExpandedGoalSetId,
                     }: {
    faction: FactionDTO;
    selectedGoalSetId: string | null;
    onSelectGoalSet: (id: string) => void;
    expandedGoalSetId: string | null;
    setExpandedGoalSetId: (id: string | null) => void;
}) {
    return (
        <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs font-semibold text-zinc-200">Quest line</div>
            <div className="mt-1 text-[11px] text-zinc-400">Select one goal set for this crew.</div>

            <div className="mt-3 grid gap-2">
                {faction.goalSets.map((gs) => {
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
                                <div className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name={`goalset_${faction.id}`}
                                        checked={checked}
                                        onChange={() => onSelectGoalSet(gs.id)}
                                    />
                                    <div className="text-sm font-medium text-zinc-100">{gs.name}</div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="hidden sm:inline text-[10px] text-zinc-500">
                                        T1: {counts[0]} | T2: {counts[1]} | T3: {counts[2]}
                                    </span>
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
                                                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                                    Tier {t}
                                                </div>
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
                {faction.goalSets.length === 0 && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-500">
                        No quest lines defined for this faction.
                    </div>
                )}
            </div>
        </section>
    );
}

function FactionPickerOverlay({
                                 factions,
                                 tier,
                                 q,
                                 onSearch,
                                 selectedFactionId,
                                 onSelectFaction,
                                 onClose,
                             }: {
    factions: FactionDTO[];
    tier: 1 | 2 | 3;
    q: string;
    onSearch: (v: string) => void;
    selectedFactionId: string | null;
    onSelectFaction: (id: string) => void;
    onClose: () => void;
}) {
    return (
        <div className="absolute inset-0 z-20 rounded-t-3xl bg-zinc-900/95 backdrop-blur flex flex-col border border-zinc-800">
            <header className="sticky top-0 z-10 border-b border-zinc-800 px-4 py-3 bg-zinc-900/95">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Choose faction</div>
                    <button onClick={onClose} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                        Close
                    </button>
                </div>
                <label className="mt-2 grid gap-1">
                    <span className="text-xs text-zinc-400">Search</span>
                    <input
                        value={q}
                        onChange={(e) => onSearch(e.target.value)}
                        placeholder="Search faction"
                        className="vault-input px-3 py-2 text-sm outline-none"
                    />
                </label>
            </header>

            <div className="vault-scrollbar flex-1 overflow-y-auto px-4 py-3">
                <div className="grid gap-2">
                    {factions.map((f) => {
                        const isSelected = f.id === selectedFactionId;
                        return (
                            <button
                                key={f.id}
                                onClick={() => onSelectFaction(f.id)}
                                className={
                                    'rounded-xl border p-3 text-left transition ' +
                                    (isSelected
                                        ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]'
                                        : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700')
                                }
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={
                                                'inline-block h-2.5 w-2.5 rounded-full ring-2 ' +
                                                (isSelected ? 'bg-emerald-400 ring-emerald-300' : 'bg-zinc-600 ring-zinc-500')
                                            }
                                            aria-hidden
                                        />
                                        <div className="text-sm font-semibold text-zinc-100">{f.name}</div>
                                    </div>
                                    <div className="text-[11px] text-zinc-400">
                                        {f.goalSets.length} quest line{f.goalSets.length === 1 ? '' : 's'}
                                    </div>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {f.limits.map((limit) => (
                                        <span
                                            key={limit.tag}
                                            className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-300"
                                        >
                                            <span className="text-zinc-400">{formatLimitTag(limit.tag)}:</span>
                                            <span className="font-semibold text-zinc-100">{tierLimitValue(limit, tier)}</span>
                                        </span>
                                    ))}
                                </div>

                                <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900 p-2">
                                    <LimitGrid limits={f.limits} />
                                </div>
                            </button>
                        );
                    })}
                    {factions.length === 0 && (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-500">
                            No factions found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
