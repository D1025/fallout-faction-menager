'use client';

import { useState } from 'react';

export type FactionLimit = { tag: string; tier1?: number | null; tier2?: number | null; tier3?: number | null; };
export type Faction = { id: string; name: string; limits: FactionLimit[] };
type FormState = { id?: string; name: string; limits: FactionLimit[] };

export function AdminFactionsClient({ initial }: { initial: Faction[] }) {
    const [list, setList] = useState<Faction[]>(initial);
    const [form, setForm] = useState<FormState>({ name: '', limits: [] });
    const [saving, setSaving] = useState(false);

    async function reloadList() {
        const res = await fetch('/api/admin/factions', { cache: 'no-store' });
        if (!res.ok) throw new Error('Nie udało się pobrać frakcji');
        const data = (await res.json()) as Faction[];
        setList(data);
    }

    async function save() {
        setSaving(true);
        try {
            // prosta walidacja klientowa
            if (!form.name.trim()) {
                alert('Podaj nazwę frakcji');
                return;
            }
            for (const l of form.limits) {
                if (!l.tag.trim()) {
                    alert('Każdy limit musi mieć tag');
                    return;
                }
            }

            const url = form.id ? `/api/admin/factions/${form.id}` : `/api/admin/factions`;
            const method = form.id ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.name.trim(), limits: form.limits }),
            });

            if (!res.ok) {
                const ct = res.headers.get('content-type');
                const payload = ct?.includes('application/json') ? await res.json() : { status: res.status, text: await res.text() };
                alert('Błąd zapisu: ' + JSON.stringify(payload));
                return;
            }

            await reloadList();
            setForm({ name: '', limits: [] }); // wyjście z trybu edycji
        } finally {
            setSaving(false);
        }
    }

    async function del(id: string) {
        if (!confirm('Usunąć frakcję? Operacja nieodwracalna.')) return;
        const res = await fetch(`/api/admin/factions/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            alert('Błąd usuwania: ' + JSON.stringify(payload));
            return;
        }
        await reloadList();
        if (form.id === id) setForm({ name: '', limits: [] });
    }

    function updateLimit(idx: number, patch: Partial<FactionLimit>) {
        setForm((f) => ({ ...f, limits: f.limits.map((x, i) => (i === idx ? { ...x, ...patch } : x)) }));
    }
    function removeLimit(idx: number) {
        setForm((f) => ({ ...f, limits: f.limits.filter((_, i) => i !== idx) }));
    }
    function numOrNull(v: string): number | null {
        const t = v.trim();
        if (!t) return null;
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
    }

    return (
        <div className="app-shell pt-3">
            <h1 className="text-lg font-semibold">Frakcje (admin)</h1>

            {/* Lista frakcji */}
            <div className="mt-3 grid gap-2">
                {list.map((f) => (
                    <div key={f.id} className="vault-panel p-3">
                        <button
                            onClick={() => setForm({ id: f.id, name: f.name, limits: f.limits })}
                            className="w-full text-left"
                            title="Edytuj"
                        >
                            <div className="flex items-center justify-between">
                                <div className="font-medium">{f.name}</div>
                                <div className="text-xs text-zinc-400">{f.limits.length} limit(y)</div>
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                                {f.limits.map((l) => `${l.tag}: ${l.tier1 ?? '–'}/${l.tier2 ?? '–'}/${l.tier3 ?? '–'}`).join(' • ')}
                            </div>
                        </button>
                        <div className="mt-2">
                            <button onClick={() => del(f.id)} className="text-xs text-red-300">Usuń</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Formularz */}
            <div className="mt-4 vault-panel p-3">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{form.id ? 'Edytuj frakcję' : 'Nowa frakcja'}</div>
                    {form.id ? (
                        <button onClick={() => setForm({ name: '', limits: [] })} className="text-xs text-zinc-300">Nowa frakcja</button>
                    ) : null}
                </div>

                <label className="mt-2 block text-xs text-zinc-400">Nazwa</label>
                <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full vault-input px-3 py-2 text-sm outline-none"
                />

                <div className="mt-3">
                    <div className="text-xs text-zinc-400 mb-1">Limity</div>

                    {form.limits.map((l, i) => (
                        <div key={i} className="mb-2 grid grid-cols-5 gap-2 items-center">
                            <input
                                value={l.tag}
                                onChange={(e) => updateLimit(i, { tag: e.target.value })}
                                placeholder="tag"
                                className="col-span-2 vault-input px-2 py-1 text-sm"
                            />
                            {(['tier1', 'tier2', 'tier3'] as const).map((k) => (
                                <input
                                    key={k}
                                    inputMode="numeric"
                                    placeholder={k.replace('tier', 'T')}
                                    value={l[k] ?? ''}
                                    onChange={(e) => updateLimit(i, { [k]: numOrNull(e.target.value) } as Partial<FactionLimit>)}
                                    className="vault-input px-2 py-1 text-sm"
                                />
                            ))}
                            <button onClick={() => removeLimit(i)} className="text-xs text-red-300">Usuń</button>
                        </div>
                    ))}

                    <button
                        onClick={() => setForm({ ...form, limits: [...form.limits, { tag: '', tier1: null, tier2: null, tier3: null }] })}
                        className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm mt-1"
                    >
                        Dodaj limit
                    </button>
                </div>

                <div className="mt-3 flex gap-2">
                    <button
                        onClick={() => setForm({ name: '', limits: [] })}
                        className="flex-1 h-10 rounded-xl border border-zinc-700"
                    >
                        Wyczyść
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="flex-1 h-10 rounded-xl bg-emerald-500 text-emerald-950 font-semibold disabled:opacity-50"
                    >
                        {saving ? 'Zapisywanie…' : 'Zapisz'}
                    </button>
                </div>
            </div>
        </div>
    );
}
