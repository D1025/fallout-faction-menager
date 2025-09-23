'use client';

import { useState } from 'react';

export function UnitClient(props: {
    armyId: string;
    unitId: string;
    name: string;
    wounds: number;
    present: boolean;
    upgradesCount: number;
    weapons: { id: string; templateId: string; mods: string[] }[];
    special: Record<'S'|'P'|'E'|'C'|'I'|'A'|'L', number>;
    photoPath: string|null;
}) {
    const [wounds, setWounds] = useState(props.wounds);
    const [present, setPresent] = useState(props.present);

    async function savePresence(val: boolean) {
        setPresent(val);
        await fetch(`/api/units/${props.unitId}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ present: val }) });
    }
    async function saveWounds(val: number) {
        setWounds(val);
        await fetch(`/api/units/${props.unitId}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ wounds: val }) });
    }

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-3">
                    <a href={`/army/${props.armyId}/roster`} className="text-sm text-zinc-300">←</a>
                    <div className="text-base font-semibold">{props.name}</div>
                    <span className="w-6" />
                </div>
            </header>

            <main className="mx-auto max-w-screen-sm px-3 pb-24">
                <section className="mt-3 grid grid-cols-2 gap-2">
                    <ToggleCard label="Obecny" value={present} onChange={savePresence} />
                    <StepperCard label="Rany (0–4)" value={wounds} min={0} max={4} onChange={saveWounds} />
                </section>

                <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="text-sm font-medium mb-2">SPECIAL</div>
                    <div className="grid grid-cols-4 gap-2">
                        {(['S','P','E','C','I','A','L'] as const).map(k => (
                            <div key={k} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-center">
                                <div className="text-xs text-zinc-400">{k}</div>
                                <div className="text-lg font-semibold">{props.special[k]}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="text-sm font-medium mb-2">Broń</div>
                    <div className="grid gap-2">
                        {props.weapons.map(w => (
                            <div key={w.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                                <div className="text-sm font-medium">Weapon #{w.templateId.slice(0,6)}</div>
                                <div className="text-xs text-zinc-400">Mody: {w.mods.length ? w.mods.join(', ') : '—'}</div>
                            </div>
                        ))}
                    </div>
                    <a href="#" className="mt-2 inline-block rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm active:scale-[0.99]">Zmień zestaw broni</a>
                </section>

                <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="text-sm font-medium mb-2">Ulepszenia & Perki</div>
                    <div className="text-xs text-zinc-400">Ulepszeń: {props.upgradesCount} • Perk co 2 ulepszenia</div>
                    <a href="#" className="mt-2 inline-block rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 active:scale-[0.99]">Dodaj ulepszenie</a>
                </section>
            </main>
        </div>
    );
}

function ToggleCard({ label, value, onChange }: { label: string; value: boolean; onChange: (val: boolean) => void|Promise<void> }) {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-400">{label}</div>
            <button onClick={() => onChange(!value)} className={'mt-1 h-10 w-full rounded-xl text-sm font-medium active:scale-[0.99] ' + (value ? 'bg-emerald-500 text-emerald-950' : 'bg-zinc-800 text-zinc-200')}>
                {value ? 'Tak' : 'Nie'}
            </button>
        </div>
    );
}
function StepperCard({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void|Promise<void> }) {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-400">{label}</div>
            <div className="mt-1 flex items-center gap-2">
                <button onClick={() => onChange(Math.max(min, value-1))} className="h-10 w-10 rounded-xl bg-zinc-800 text-xl active:scale-95">−</button>
                <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 text-center text-lg font-semibold">{value}</div>
                <button onClick={() => onChange(Math.min(max, value+1))} className="h-10 w-10 rounded-xl bg-zinc-800 text-xl active:scale-95">＋</button>
            </div>
        </div>
    );
}
