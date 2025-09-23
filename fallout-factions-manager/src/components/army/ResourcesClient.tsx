'use client';

import { useState } from 'react';

type Kind = 'caps'|'parts'|'reach';

export function ResourcesClient(props: {
    armyId: string;
    armyName: string;
    totals: Record<Kind, number>;
    history: { id: string; kind: Kind; delta: number; at: string; note: string }[];
}) {
    const [totals, setTotals] = useState(props.totals);

    async function change(kind: Kind, delta: number, note?: string) {
        setTotals(t => ({ ...t, [kind]: (t[kind] ?? 0) + delta }));
        await fetch(`/api/resources/${props.armyId}`, {
            method: 'POST', headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ kind, delta, note }),
        });
    }

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-3">
                    <a href={`/army/${props.armyId}`} className="text-sm text-zinc-300">←</a>
                    <div className="text-base font-semibold">Zasoby: {props.armyName}</div>
                    <span className="w-6" />
                </div>
            </header>

            <main className="mx-auto max-w-screen-sm px-3 pb-24">
                <div className="mt-3 grid grid-cols-3 gap-2">
                    {(['caps','parts','reach'] as const).map(k => (
                        <div key={k} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-center">
                            <div className="text-xs text-zinc-400">{k.toUpperCase()}</div>
                            <div className="text-lg font-semibold">{totals[k] ?? 0}</div>
                            <div className="mt-2 flex gap-1">
                                {[+1,+5,+10].map(n => (
                                    <button key={n} onClick={() => change(k, n)} className="flex-1 rounded-lg bg-zinc-800 py-1 text-sm active:scale-95">+{n}</button>
                                ))}
                            </div>
                            <div className="mt-1 flex gap-1">
                                {[-1,-5,-10].map(n => (
                                    <button key={n} onClick={() => change(k, n)} className="flex-1 rounded-lg bg-zinc-800 py-1 text-sm active:scale-95">{n}</button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="text-sm font-medium mb-2">Historia</div>
                    <div className="grid gap-1">
                        {props.history.map(h => (
                            <div key={h.id} className="flex justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                                <div className="text-zinc-300">{h.kind.toUpperCase()} {h.delta>0?`+${h.delta}`:h.delta}</div>
                                <div className="text-xs text-zinc-500">{new Date(h.at).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
