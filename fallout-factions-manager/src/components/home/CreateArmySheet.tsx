'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type FactionDTO = {
    id: string;
    name: string;
    limits: { tag: string; tier1: number | null; tier2: number | null; tier3: number | null }[];
    goalSets: { id: string; name: string; goals: { tier: 1 | 2 | 3; description: string; target: number; order: number }[] }[];
};

export default function CreateArmySheet({ factions }: { factions: FactionDTO[] }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 active:scale-[0.99]"
            >
                Dodaj nową
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
    const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
    const [selectedGoalSetId, setSelectedGoalSetId] = useState<string | null>(null);

    const selectedFaction = useMemo(
        () => factions.find(f => f.id === selectedFactionId) ?? null,
        [selectedFactionId, factions]
    );
    const can = name.trim().length >= 3 && selectedFaction;

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return factions;
        return factions.filter(f => f.name.toLowerCase().includes(s));
    }, [q, factions]);

    async function createArmy() {
        const res = await fetch('/api/armies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), factionId: selectedFaction!.id, tier }),
        });
        if (!res.ok) {
            const txt = await res.text().catch(()=> '');
            alert('Nie udało się utworzyć armii: ' + txt);
            return;
        }
        const { id } = (await res.json()) as { id: string };
        onClose();
        router.push(`/army/${id}`); // <-- tu zmiana (było /unit)
    }

    return (
        <div className="fixed inset-0 z-20">
            <button aria-label="Zamknij" onClick={onClose} className="absolute inset-0 bg-black/60" />
            <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-screen-sm rounded-t-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />

                <div className="text-sm text-zinc-400">Nowa drużyna</div>

                <div className="mt-2 grid gap-2">
                    <label className="grid gap-1">
                        <span className="text-xs text-zinc-400">Nazwa</span>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="np. Oddział Alfa"
                            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                        />
                    </label>

                    <div className="grid gap-1">
                        <span className="text-xs text-zinc-400">Tier</span>
                        <div className="flex gap-2">
                            {[1,2,3].map(t=>(
                                <button key={t}
                                        onClick={()=> setTier(t as 1|2|3)}
                                        className={'h-9 flex-1 rounded-xl border px-3 text-sm font-medium active:scale-[0.98] ' + (tier===t ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300')}>
                                    Tier {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="grid gap-1 mt-2">
                        <span className="text-xs text-zinc-400">Frakcja</span>
                        <input
                            value={q}
                            onChange={(e)=> setQ(e.target.value)}
                            placeholder="Szukaj frakcji"
                            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none"
                        />
                    </label>

                    <div className="mt-2 grid gap-2 max-h-72 overflow-y-auto pr-1">
                        {filtered.map(f=> {
                            const isSelected = f.id === selectedFactionId;
                            return (
                                <div
                                    key={f.id}
                                    className={
                                        'rounded-xl border p-0 overflow-hidden ' +
                                        (isSelected ? 'border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]' : 'border-zinc-800')
                                    }
                                >
                                    <button
                                        onClick={()=> {
                                            setSelectedFactionId(f.id);
                                            setSelectedGoalSetId(f.goalSets[0]?.id ?? null);
                                        }}
                                        className="flex w-full items-center justify-between p-3 text-left bg-zinc-950"
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
                                        <span className="text-[10px] text-zinc-400">
                      {isSelected ? 'WYBRANO • ' : ''}
                                            {f.limits.length} limit(ów) • {f.goalSets.length} zest.(y) zadań
                    </span>
                                    </button>

                                    <div className="border-t border-zinc-800 p-3 text-xs text-zinc-300 bg-zinc-900">
                                        <div className="font-semibold text-zinc-200">Limity</div>
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                            {f.limits.map(l=>(
                                                <span key={l.tag} className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5">
                          <span className="font-medium">{l.tag}</span>
                          <span className="text-zinc-500">{[l.tier1,l.tier2,l.tier3].map(v=> v ?? '–').join('/')}</span>
                        </span>
                                            ))}
                                            {f.limits.length===0 && <span className="text-zinc-500">brak</span>}
                                        </div>

                                        <div className="mt-3 font-semibold text-zinc-200">Zestawy zadań</div>
                                        <div className="mt-1 grid gap-2">
                                            {f.goalSets.map(gs=> {
                                                const checked = isSelected && selectedGoalSetId === gs.id;
                                                return (
                                                    <label
                                                        key={gs.id}
                                                        className={
                                                            'block rounded-lg border p-2 ' +
                                                            (checked ? 'border-emerald-400 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950')
                                                        }
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="radio"
                                                                    name={`goalset_${f.id}`}
                                                                    checked={checked}
                                                                    disabled={!isSelected}
                                                                    onChange={()=> {
                                                                        setSelectedFactionId(f.id);
                                                                        setSelectedGoalSetId(gs.id);
                                                                    }}
                                                                />
                                                                <div className="font-medium">{gs.name}</div>
                                                            </div>
                                                            <span className="text-[10px] text-zinc-500">po 3 cele na tier</span>
                                                        </div>
                                                        {[1,2,3].map(tier=>(
                                                            <div key={tier} className="mt-1">
                                                                <div className="text-[10px] text-zinc-400">TIER {tier}</div>
                                                                <ul className="ml-4 list-disc">
                                                                    {gs.goals
                                                                        .filter(g=>g.tier===tier)
                                                                        .sort((a,b)=>a.order-b.order)
                                                                        .map((g,i)=>(
                                                                            <li key={i} className="text-[11px] text-zinc-300">
                                                                                {g.description} <span className="text-zinc-500">(x{g.target})</span>
                                                                            </li>
                                                                        ))}
                                                                </ul>
                                                            </div>
                                                        ))}
                                                    </label>
                                                );
                                            })}
                                            {f.goalSets.length===0 && <div className="text-zinc-500">brak zestawów</div>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filtered.length===0 && <div className="text-sm text-zinc-500">Brak wyników</div>}
                    </div>
                </div>

                <div className="mt-4 flex gap-2">
                    <button onClick={onClose} className="h-11 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-300 active:scale-[0.99]">
                        Anuluj
                    </button>
                    <button
                        disabled={!can}
                        onClick={()=> void createArmy()}
                        className="h-11 flex-1 rounded-2xl bg-emerald-500 text-sm font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
                    >
                        Utwórz
                    </button>
                </div>
            </div>
        </div>
    );
}
