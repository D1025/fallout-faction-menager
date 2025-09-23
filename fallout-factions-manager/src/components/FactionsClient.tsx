'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

/* ===== Types ===== */
export type FactionLimit = { tag: string; tier1?: number | null; tier2?: number | null; tier3?: number | null };
export type Faction = { id: string; name: string; limits: FactionLimit[] };
type CreateArmyPayload = { name: string; factionId: string; tier: 1 | 2 | 3 };

/* ===== Helper API (lokalnie w pliku, bez importów) ===== */
async function createArmy(payload: CreateArmyPayload): Promise<{ id: string }> {
    try {
        const res = await fetch('/api/armies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) return (await res.json()) as { id: string };
        // fallback na wypadek 4xx/5xx (żeby UI demo działał)
        return { id: `mock_${Math.random().toString(36).slice(2)}` };
    } catch {
        return { id: `mock_${Math.random().toString(36).slice(2)}` };
    }
}

/* ===== Komponent ===== */
export function FactionsClient({ initialFactions }: { initialFactions: Faction[] }) {
    const router = useRouter();
    const [q, setQ] = useState('');
    const [selected, setSelected] = useState<Faction | null>(null);
    const [creating, setCreating] = useState(false);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return initialFactions;
        return initialFactions.filter((f) => f.name.toLowerCase().includes(s));
    }, [q, initialFactions]);

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <Header title="Wybierz frakcję" />

            <main className="mx-auto w-full max-w-screen-sm px-3 pb-24">
                <Search value={q} onChange={setQ} placeholder="Szukaj frakcji" />

                <div className="mt-3 grid grid-cols-1 gap-3">
                    {filtered.map((f) => (
                        <FactionCard
                            key={f.id}
                            faction={f}
                            onChoose={() => {
                                setSelected(f);
                                setCreating(true);
                            }}
                        />
                    ))}
                </div>
            </main>

            {creating && selected && (
                <CreateArmySheet
                    faction={selected}
                    onClose={() => setCreating(false)}
                    onSubmit={async (_payload) => {
                        const { id } = await createArmy(_payload);
                        setCreating(false);
                        router.push(`/army/${id}`);
                    }}
                />
            )}
        </div>
    );
}

/* ========== UI Building Blocks (mobile-first) ========== */
function Header({ title }: { title: string }) {
    return (
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-screen-sm items-center justify-between px-3">
                <div className="text-lg font-semibold tracking-wide">{title}</div>
                <div className="text-xs text-zinc-400">mobile-first</div>
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
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2">
                <Magnifier className="h-5 w-5 text-zinc-400" />
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                />
                {value && (
                    <button onClick={() => onChange('')} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 active:scale-95">
                        ✕
                    </button>
                )}
            </div>
        </label>
    );
}

function FactionCard({ faction, onChoose }: { faction: Faction; onChoose: () => void }) {
    return (
        <button
            onClick={onChoose}
            className="group flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-left active:scale-[0.99]"
        >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-zinc-800 text-zinc-300">
                {faction.name.slice(0, 2)}
            </div>
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <div className="text-base font-semibold leading-tight">{faction.name}</div>
                    <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
            tap, aby wybrać
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

function CreateArmySheet({
                             faction,
                             onClose,
                             onSubmit,
                         }: {
    faction: Faction;
    onClose: () => void;
    onSubmit: (payload: CreateArmyPayload) => void | Promise<void>;
}) {
    const [tier, setTier] = useState<1 | 2 | 3>(1);
    const [name, setName] = useState('');
    const canSubmit = name.trim().length >= 3;

    return (
        <div className="fixed inset-0 z-20">
            {/* backdrop */}
            <button aria-label="Zamknij" onClick={onClose} className="absolute inset-0 bg-black/60" />

            {/* sheet */}
            <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-screen-sm rounded-t-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
                <div className="mb-2 text-sm text-zinc-400">Tworzysz armię dla</div>
                <div className="text-lg font-semibold">{faction.name}</div>

                <div className="mt-4 grid gap-3">
                    <label className="grid gap-1">
                        <span className="text-xs text-zinc-400">Nazwa armii</span>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="np. Oddział Alfa"
                            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                        />
                    </label>

                    <div className="grid gap-2">
                        <span className="text-xs text-zinc-400">Tier</span>
                        <div className="flex gap-2">
                            {[1, 2, 3].map((t) => (
                                <TierPill key={t} active={tier === t} onClick={() => setTier(t as 1 | 2 | 3)}>
                                    Tier {t}
                                </TierPill>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <span className="text-xs text-zinc-400">Wybrane limity (Tier {tier})</span>
                        <div className="flex flex-wrap gap-1.5">
                            {faction.limits.map((l) => (
                                <LimitBadge key={l.tag} tag={l.tag} values={[tier === 1 ? l.tier1 : tier === 2 ? l.tier2 : l.tier3]} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex gap-2">
                    <button
                        onClick={onClose}
                        className="h-11 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-300 active:scale-[0.99]"
                    >
                        Anuluj
                    </button>
                    <button
                        disabled={!canSubmit}
                        onClick={() => onSubmit({ name: name.trim(), factionId: faction.id, tier })}
                        className="h-11 flex-1 rounded-2xl bg-emerald-500 text-sm font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
                    >
                        Utwórz armię
                    </button>
                </div>
            </div>
        </div>
    );
}

function TierPill(props: React.PropsWithChildren<{ active?: boolean; onClick?: () => void }>) {
    return (
        <button
            onClick={props.onClick}
            className={
                'h-9 flex-1 rounded-xl border px-3 text-sm font-medium active:scale-[0.98] ' +
                (props.active ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300')
            }
        >
             {props.children}
        </button>
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
