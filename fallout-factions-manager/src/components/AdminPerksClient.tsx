'use client';

import { useEffect, useState } from 'react';

type Behavior = 'NONE' | 'COMPANION_ROBOT' | 'COMPANION_BEAST';

type Perk = {
    id: string;
    name: string;
    description: string;
    requiresValue: boolean;
    startAllowed: boolean;
    behavior: Behavior;
};

type PerkForm = Omit<Perk, 'id'>;

export function AdminPerksClient() {
    const [list, setList] = useState<Perk[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<PerkForm>({
        name: '', description: '', requiresValue: false, startAllowed: false, behavior: 'NONE'
    });

    async function reload() {
        const res = await fetch('/api/admin/perks', { cache: 'no-store' });
        setList(await res.json());
    }
    useEffect(() => { void reload(); }, []);

    function reset() {
        setEditingId(null);
        setForm({ name: '', description: '', requiresValue: false, startAllowed: false, behavior: 'NONE' });
    }

    async function save() {
        if (!form.name.trim() || !form.description.trim()) { alert('Uzupełnij nazwę i opis'); return; }
        const method: 'POST'|'PATCH' = editingId ? 'PATCH' : 'POST';
        const url = editingId ? `/api/admin/perks/${editingId}` : '/api/admin/perks';
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        if (!res.ok) { alert('Błąd zapisu'); return; }
        reset(); await reload();
    }

    async function del(id: string) {
        if (!confirm('Usunąć perk?')) return;
        const res = await fetch(`/api/admin/perks/${id}`, { method: 'DELETE' });
        if (!res.ok) { alert('Błąd usuwania'); return; }
        if (editingId === id) reset();
        await reload();
    }

    return (
        <div className="grid gap-3">
            <div className="grid gap-2">
                {list.map(p => (
                    <div key={p.id} className="rounded-xl border border-zinc-800 p-3">
                        <div className="flex items-center justify-between">
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-zinc-400">
                                {p.startAllowed ? 'startowy • ' : ''}{p.behavior}
                            </div>
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">{p.description}</div>
                        <div className="mt-2 flex gap-3">
                            <button className="text-xs" onClick={() => { setEditingId(p.id); setForm({
                                name: p.name, description: p.description, requiresValue: p.requiresValue, startAllowed: p.startAllowed, behavior: p.behavior
                            }); }}>Edytuj</button>
                            <button className="text-xs text-red-300" onClick={() => void del(p.id)}>Usuń</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="rounded-xl border border-zinc-800 p-3">
                <div className="text-sm font-medium">{editingId ? 'Edytuj perk' : 'Nowy perk'}</div>

                <label className="block mt-2 text-xs text-zinc-400">Nazwa</label>
                <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}
                       className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />

                <label className="block mt-2 text-xs text-zinc-400">Opis (użyj X jako zmiennej)</label>
                <textarea rows={3} value={form.description} onChange={e=>setForm({...form, description:e.target.value})}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />

                <div className="mt-2 grid grid-cols-2 gap-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.requiresValue} onChange={e=>setForm({...form, requiresValue: e.target.checked})}/>
                        Wymaga wartości (X)
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.startAllowed} onChange={e=>setForm({...form, startAllowed: e.target.checked})}/>
                        Do wyboru na starcie
                    </label>
                </div>

                <label className="block mt-2 text-xs text-zinc-400">Zachowanie</label>
                <select value={form.behavior} onChange={e=>setForm({...form, behavior: e.target.value as Behavior})}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="NONE">Brak</option>
                    <option value="COMPANION_ROBOT">Kontroler robota (darmowy na starcie; płacisz koszt robota)</option>
                    <option value="COMPANION_BEAST">Kontroler zwierzaka (darmowy na starcie; płacisz koszt zwierzaka)</option>
                </select>

                <div className="mt-3 flex gap-2">
                    <button className="flex-1 h-10 rounded-xl border border-zinc-700" onClick={reset}>Wyczyść</button>
                    <button className="flex-1 h-10 rounded-xl bg-emerald-500 text-emerald-950 font-semibold" onClick={() => void save()}>Zapisz</button>
                </div>
            </div>
        </div>
    );
}
