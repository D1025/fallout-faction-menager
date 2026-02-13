'use client';

import { ArrowLeftOutlined, CloseOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';

/* ===== Types ===== */
export type FactionLimit = { tag: string; tier1?: number | null; tier2?: number | null; tier3?: number | null };
export type Goal = { id?: string; tier: 1 | 2 | 3; description: string; target: number; order: number };
export type GoalSet = { id?: string; name: string; goals: Goal[] };
export type UpgradeRule = { statKey: string; ratingPerPoint: number };

export type Faction = {
    id: string;
    name: string;
    limits: FactionLimit[];
    goalSets: GoalSet[];
    upgradeRules: UpgradeRule[];
};

export type UIFaction = Faction;

/* ===== Utils ===== */
function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

/* ===== API helpers ===== */
async function postFaction(payload: { name: string; limits: FactionLimit[] }): Promise<{ id: string; name: string }> {
    const res = await fetch(`/api/admin/factions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
async function patchFaction(id: string, payload: { name: string; limits: FactionLimit[] }): Promise<void> {
    const res = await fetch(`/api/admin/factions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
}
async function deleteFaction(id: string): Promise<void> {
    const res = await fetch(`/api/admin/factions/${id}`, { method: 'DELETE' });
    if (res.status === 204) return;
    if (!res.ok) throw new Error(await res.text());
}
async function putGoals(factionId: string, sets: GoalSet[]): Promise<void> {
    const res = await fetch(`/api/admin/factions/${factionId}/goals`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sets }),
    });
    if (!res.ok) throw new Error(await res.text());
}
async function putUpgrades(factionId: string, rules: UpgradeRule[]): Promise<void> {
    const res = await fetch(`/api/admin/factions/${factionId}/upgrades`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
    });
    if (!res.ok) throw new Error(await res.text());
}

/* ===== Komponent ===== */
export function FactionsClient({ initialFactions }: { initialFactions: UIFaction[] }) {
    const router = useRouter();
    const [q, setQ] = useState('');
    const [factions, setFactions] = useState<UIFaction[]>(initialFactions);
    const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; data: UIFaction } | null>(null);
    const [savingAll, setSavingAll] = useState(false);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return factions;
        return factions.filter((f) => f.name.toLowerCase().includes(s));
    }, [q, factions]);

    function openCreate() {
        const emptyGoals = ([1, 2, 3] as const).flatMap((t) =>
            [0, 1, 2].map((order) => ({ tier: t as 1 | 2 | 3, description: '—', target: 1, order })),
        );
        const blank: UIFaction = {
            id: 'NEW',
            name: '',
            limits: [],
            goalSets: [{ name: 'Zestaw 1', goals: emptyGoals }],
            upgradeRules: [
                { statKey: 'hp', ratingPerPoint: 0 },
                { statKey: 'S', ratingPerPoint: 0 },
                { statKey: 'P', ratingPerPoint: 0 },
                { statKey: 'E', ratingPerPoint: 0 },
                { statKey: 'C', ratingPerPoint: 0 },
                { statKey: 'I', ratingPerPoint: 0 },
                { statKey: 'A', ratingPerPoint: 0 },
                { statKey: 'L', ratingPerPoint: 0 },
            ],
        };
        setEditor({ mode: 'create', data: blank });
    }

    function openEdit(f: UIFaction) {
        const deep = JSON.parse(JSON.stringify(f)) as UIFaction;
        setEditor({ mode: 'edit', data: deep });
    }

    function upsertLocalFaction(updated: UIFaction) {
        setFactions((prev) => {
            const exists = prev.some((f) => f.id === updated.id);
            return exists ? prev.map((f) => (f.id === updated.id ? updated : f)) : [updated, ...prev];
        });
    }

    function removeLocalFaction(id: string) {
        setFactions((prev) => prev.filter((f) => f.id !== id));
    }

    return (
        <div className="min-h-dvh">
            <Header
                title="Frakcje – limity, zadania, ulepszenia"
                right={
                    <button
                        onClick={openCreate}
                        className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
                    >
                        + Dodaj frakcję
                    </button>
                }
            />

            <main className="app-shell">
                <Search value={q} onChange={setQ} placeholder="Szukaj frakcji" />

                <div className="mt-3 grid grid-cols-1 gap-3">
                    {filtered.map((f) => (
                        <FactionCard key={f.id} faction={f} onOpen={() => openEdit(f)} />
                    ))}
                </div>
            </main>

            {editor && (
                <EditorSheet
                    mode={editor.mode}
                    initial={editor.data}
                    onCancel={() => setEditor(null)}
                    onSaved={(saved) => {
                        upsertLocalFaction(saved);
                        setEditor(null);
                        router.refresh();
                    }}
                    onDeleted={(id) => {
                        removeLocalFaction(id);
                        setEditor(null);
                        router.refresh();
                    }}
                    onDeleteRequest={async (id) => {
                        confirmAction({
                            title: 'Na pewno usunąć frakcję? Operacja nieodwracalna.',
                            okText: 'Usuń',
                            cancelText: 'Anuluj',
                            danger: true,
                            onOk: async () => {
                                await deleteFaction(id);
                                router.refresh();
                            },
                        });
                    }}
                    saving={savingAll}
                    onSaveAll={async (draft) => {
                        setSavingAll(true);
                        try {
                            if (editor.mode === 'create') {
                                const created = await postFaction({
                                    name: draft.name.trim(),
                                    limits: draft.limits,
                                });
                                const newId = created.id;
                                await putGoals(newId, draft.goalSets);
                                await putUpgrades(newId, draft.upgradeRules);
                                return { ...draft, id: newId, name: created.name };
                            } else {
                                await patchFaction(draft.id, {
                                    name: draft.name.trim(),
                                    limits: draft.limits,
                                });
                                await putGoals(draft.id, draft.goalSets);
                                await putUpgrades(draft.id, draft.upgradeRules);
                                return draft;
                            }
                        } finally {
                            setSavingAll(false);
                        }
                    }}
                />
            )}
        </div>
    );
}

/* ========== UI ========== */

function Header({ title, right }: { title: string; right?: React.ReactNode }) {
    return (
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-[560px] items-center justify-between px-3">
                <div className="text-lg font-semibold tracking-wide">{title}</div>
                <div className="text-xs text-zinc-400">{right}</div>
            </div>
        </header>
    );
}

function Search({
                    value,
                    onChange,
                    placeholder,
                }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <label className="block">
            <div className="flex items-center gap-2 vault-panel px-3 py-2">
                <Magnifier className="h-5 w-5 text-zinc-400" />
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                />
                {value && (
                    <button onClick={() => onChange('')} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 active:scale-95">
                        <CloseOutlined />
                    </button>
                )}
            </div>
        </label>
    );
}

function FactionCard({ faction, onOpen }: { faction: UIFaction; onOpen: () => void }) {
    return (
        <button
            onClick={onOpen}
            className="group flex items-center gap-3 vault-panel p-3 text-left active:scale-[0.99]"
        >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-zinc-800 text-zinc-300">
                {faction.name.slice(0, 2)}
            </div>
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <div className="text-base font-semibold leading-tight">{faction.name}</div>
                    <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
            edytuj
          </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                    {faction.limits.slice(0, 3).map((l) => (
                        <LimitBadge key={l.tag} tag={l.tag} values={[l.tier1, l.tier2, l.tier3]} />
                    ))}
                </div>
            </div>
        </button>
    );
}

function LimitBadge({ tag, values }: { tag: string; values: (number | null | undefined)[] }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-300">
      <span className="font-medium">{tag}</span>
      <span className="text-zinc-500">{values.map((v) => (v ?? '–')).join('/')}</span>
    </span>
    );
}

/* ====== EDITOR SHEET ====== */

function EditorSheet({
                         mode,
                         initial,
                         onCancel,
                         onSaved,
                         onSaveAll,
                         onDeleted,
                         onDeleteRequest,
                         saving,
                     }: {
    mode: 'create' | 'edit';
    initial: UIFaction;
    onCancel: () => void;
    onSaved: (saved: UIFaction) => void;
    onSaveAll: (draft: UIFaction) => Promise<UIFaction>;
    onDeleted: (id: string) => void;
    onDeleteRequest: (id: string) => Promise<void>;
    saving: boolean;
}) {
    const [draft, setDraft] = useState<UIFaction>(initial);

    function handleCancel() {
        setDraft(initial);
        onCancel();
    }

    function setName(name: string) {
        setDraft((d) => ({ ...d, name }));
    }

    /* === LIMITY === */
    function addLimit() {
        setDraft((d) => ({ ...d, limits: [...d.limits, { tag: '', tier1: null, tier2: null, tier3: null }] }));
    }
    function removeLimit(idx: number) {
        setDraft((d) => ({ ...d, limits: d.limits.filter((_, i) => i !== idx) }));
    }
    function setLimit(idx: number, field: keyof FactionLimit, value: string) {
        setDraft((d) => ({
            ...d,
            limits: d.limits.map((l, i) =>
                i === idx
                    ? {
                        ...l,
                        [field]:
                            field === 'tag'
                                ? value
                                : value.trim() === ''
                                    ? null
                                    : Number.isFinite(Number(value))
                                        ? Number(value)
                                        : l[field],
                    }
                    : l,
            ),
        }));
    }

    /* === ZESTAWY ZADAŃ === */
    function addGoalSet() {
        const emptyGoals = ([1, 2, 3] as const).flatMap((t) =>
            [0, 1, 2].map((order) => ({ tier: t as 1 | 2 | 3, description: '—', target: 1, order })),
        );
        setDraft((d) => ({ ...d, goalSets: [...d.goalSets, { name: `Zestaw ${d.goalSets.length + 1}`, goals: emptyGoals }] }));
    }
    function removeGoalSet(idx: number) {
        setDraft((d) => ({ ...d, goalSets: d.goalSets.filter((_, i) => i !== idx) }));
    }
    function setGoalSetName(idx: number, name: string) {
        setDraft((d) => ({ ...d, goalSets: d.goalSets.map((s, i) => (i === idx ? { ...s, name } : s)) }));
    }
    function setGoal(setIdx: number, tier: 1 | 2 | 3, order: number, field: 'description' | 'target', value: string) {
        setDraft((d) => ({
            ...d,
            goalSets: d.goalSets.map((gs, i) => {
                if (i !== setIdx) return gs;
                const goals = gs.goals.map((g) => (g.tier === tier && g.order === order ? { ...g, [field]: field === 'target' ? Number(value) || 0 : value } : g));
                return { ...gs, goals };
            }),
        }));
    }

    /* === UPGRADE RULES === */
    const statKeys = ['hp', 'S', 'P', 'E', 'C', 'I', 'A', 'L'] as const;
    function setRule(statKey: string, ratingPerPoint: number) {
        setDraft((d) => {
            const exists = d.upgradeRules.find((r) => r.statKey === statKey);
            const rules = exists
                ? d.upgradeRules.map((r) => (r.statKey === statKey ? { ...r, ratingPerPoint } : r))
                : [...d.upgradeRules, { statKey, ratingPerPoint }];
            return { ...d, upgradeRules: rules };
        });
    }

    async function handleSaveAll() {
        if (!draft.name.trim()) {
            notifyWarning('Podaj nazwę frakcji.');
            return;
        }
        try {
            const saved = await onSaveAll(draft);
            onSaved(saved);
        } catch (e: unknown) {
            notifyApiError(getErrorMessage(e), 'Błąd zapisu frakcji');
        }
    }

    return (
        <div className="fixed inset-0 z-20">
            <button aria-label="Zamknij" onClick={handleCancel} className="absolute inset-0 bg-black/60" />

            <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[92dvh] w-full max-w-screen-sm flex-col rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-xl">
                <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-zinc-700" />

                {/* sticky header */}
                <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 px-4 pb-3 pt-3 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={handleCancel}
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 active:scale-[0.99]"
                        >
                            <ArrowLeftOutlined /> Wróć
                        </button>
                        <div className="min-w-0 flex-1 text-center">
                            <div className="truncate text-sm font-semibold">
                                {mode === 'create' ? 'Nowa frakcja' : 'Edycja frakcji'}
                            </div>
                        </div>
                        <div className="w-[72px]" />
                    </div>

                    {/* nazwa + usuń */}
                    <div className="mt-3 flex items-center gap-2">
                        <input
                            value={draft.name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nazwa frakcji"
                            className="flex-1 vault-input px-3 py-2 text-sm"
                        />
                        {mode === 'edit' && (
                            <button
                                onClick={async () => {
                                    try {
                                        await onDeleteRequest(draft.id);
                                        onDeleted(draft.id);
                                    } catch (e: unknown) {
                                        notifyApiError(getErrorMessage(e), 'Nie udało się usunąć frakcji');
                                    }
                                }}
                                className="rounded-xl border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-200"
                            >
                                Usuń
                            </button>
                        )}
                    </div>

                    <div className="mt-2 text-[11px] text-zinc-400">
                        Tip: możesz zawsze wrócić bez zapisu. Zmiany zapisujesz przyciskiem „Zapisz”.
                    </div>
                </header>

                {/* scrollable content */}
                <div className="flex-1 overflow-y-auto px-4 pb-28 pt-3">
                    {/* LIMITY */}
                    <section className="mt-1">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">Limity</div>
                            <button onClick={addLimit} className="text-xs text-emerald-300">Dodaj limit</button>
                        </div>
                        <div className="mt-2 grid gap-2">
                            {draft.limits.map((l, idx) => (
                                <div key={idx} className="grid grid-cols-7 items-center gap-2 rounded-xl border border-zinc-800 p-2">
                                    <input
                                        value={l.tag}
                                        onChange={(e) => setLimit(idx, 'tag', e.target.value)}
                                        placeholder="Tag (np. LEADER)"
                                        className="col-span-3 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                    />
                                    <input
                                        value={l.tier1 ?? ''}
                                        inputMode="numeric"
                                        placeholder="T1"
                                        onChange={(e) => setLimit(idx, 'tier1', e.target.value)}
                                        className="col-span-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                    />
                                    <input
                                        value={l.tier2 ?? ''}
                                        inputMode="numeric"
                                        placeholder="T2"
                                        onChange={(e) => setLimit(idx, 'tier2', e.target.value)}
                                        className="col-span-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                    />
                                    <input
                                        value={l.tier3 ?? ''}
                                        inputMode="numeric"
                                        placeholder="T3"
                                        onChange={(e) => setLimit(idx, 'tier3', e.target.value)}
                                        className="col-span-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                    />
                                    <button onClick={() => removeLimit(idx)} className="text-xs text-red-300">Usuń</button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ZESTAWY ZADAŃ */}
                    <section className="mt-6">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">Zestawy zadań</div>
                            <button onClick={addGoalSet} className="text-xs text-emerald-300">Dodaj zestaw</button>
                        </div>

                        {draft.goalSets.map((gs, setIdx) => (
                            <div key={setIdx} className="mt-2 rounded-xl border border-zinc-800 p-3">
                                <div className="flex items-center justify-between">
                                    <input
                                        value={gs.name}
                                        onChange={(e) => setGoalSetName(setIdx, e.target.value)}
                                        className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                    />
                                    <button onClick={() => removeGoalSet(setIdx)} className="text-xs text-red-300">Usuń</button>
                                </div>

                                {[1, 2, 3].map((t) => (
                                    <div key={t} className="mt-3">
                                        <div className="text-xs font-semibold text-zinc-300">TIER {t}</div>
                                        {[0, 1, 2].map((order) => {
                                            const g =
                                                gs.goals.find((x) => x.tier === t && x.order === order) || ({
                                                    tier: t as 1 | 2 | 3,
                                                    description: '',
                                                    target: 0,
                                                    order,
                                                } as Goal);
                                            return (
                                                <div key={order} className="mt-1 grid grid-cols-12 gap-2">
                                                    <input
                                                        placeholder={`Opis #${order + 1}`}
                                                        value={g.description}
                                                        onChange={(e) => setGoal(setIdx, t as 1 | 2 | 3, order, 'description', e.target.value)}
                                                        className="col-span-9 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                                    />
                                                    <input
                                                        placeholder="Target"
                                                        inputMode="numeric"
                                                        value={g.target}
                                                        onChange={(e) => setGoal(setIdx, t as 1 | 2 | 3, order, 'target', e.target.value)}
                                                        className="col-span-3 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </section>

                    {/* UPGRADE RULES */}
                    <section className="mt-6">
                        <div className="text-sm font-medium">Tabela ulepszeń (rating za +1)</div>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                            {statKeys.map((k) => {
                                const v = draft.upgradeRules.find((r) => r.statKey === k)?.ratingPerPoint ?? 0;
                                return (
                                    <div key={k}>
                                        <label className="block text-[10px] text-zinc-400 uppercase">{k}</label>
                                        <input
                                            inputMode="numeric"
                                            value={v}
                                            onChange={(e) => {
                                                const num = Number(e.target.value);
                                                setRule(k, Number.isFinite(num) ? num : 0);
                                            }}
                                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                {/* sticky footer actions */}
                <footer className="sticky bottom-0 z-10 border-t border-zinc-800 bg-zinc-900/95 p-4 backdrop-blur">
                    <div className="flex gap-2">
                        <button
                            onClick={handleCancel}
                            className="h-11 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-300 active:scale-[0.99]"
                        >
                            Anuluj
                        </button>
                        <button
                            disabled={saving}
                            onClick={() => void handleSaveAll()}
                            className="h-11 flex-1 rounded-2xl bg-emerald-500 text-sm font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
                        >
                            {saving ? 'Zapisywanie…' : 'Zapisz'}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function Magnifier(props: React.HTMLAttributes<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="11" cy="11" r="7" strokeWidth="2" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
        </svg>
    );
}
