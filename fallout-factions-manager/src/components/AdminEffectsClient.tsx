'use client';

import { useEffect, useState } from 'react';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';

export type EffectKind = 'WEAPON' | 'CRITICAL';

export interface Effect {
    id: string;
    name: string;
    kind: EffectKind;
    description: string;
    requiresValue: boolean;
}

// Oddzielamy identyfikator edytowanego efektu od samych pól formularza
interface EffectForm {
    name: string;
    kind: EffectKind;
    description: string;
    requiresValue: boolean;
}

export function AdminEffectsClient() {
    const [list, setList] = useState<Effect[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<EffectForm>({
        name: '',
        kind: 'WEAPON',
        description: '',
        requiresValue: false,
    });

    async function reload(): Promise<void> {
        const res = await fetch('/api/admin/effects', { cache: 'no-store' });
        if (!res.ok) {
            notifyApiError('Nie udało się pobrać efektów');
            return;
        }
        const data: Effect[] = await res.json();
        setList(data);
    }

    useEffect(() => {
        void reload();
    }, []);

    function startEdit(e: Effect): void {
        setEditingId(e.id);
        setForm({
            name: e.name,
            kind: e.kind,
            description: e.description,
            requiresValue: e.requiresValue,
        });
    }

    function resetForm(): void {
        setEditingId(null);
        setForm({ name: '', kind: 'WEAPON', description: '', requiresValue: false });
    }

    async function save(): Promise<void> {
        if (!form.name.trim()) {
            notifyWarning('Podaj nazwę efektu');
            return;
        }
        if (!form.description.trim()) {
            notifyWarning('Podaj opis efektu');
            return;
        }

        const method: 'POST' | 'PATCH' = editingId ? 'PATCH' : 'POST';
        const url = editingId ? `/api/admin/effects/${editingId}` : '/api/admin/effects';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form satisfies EffectForm),
        });

        if (!res.ok) {
            const payload = await res
                .json()
                .catch(async () => ({ status: res.status, text: await res.text() }));
            notifyApiError(JSON.stringify(payload), 'Błąd zapisu efektu');
            return;
        }

        resetForm();
        await reload();
    }

    async function del(id: string): Promise<void> {
        confirmAction({
            title: 'Usunąć efekt?',
            okText: 'Usuń',
            cancelText: 'Anuluj',
            danger: true,
            onOk: async () => {
                const res = await fetch(`/api/admin/effects/${id}`, { method: 'DELETE' });
                if (!res.ok) {
                    const payload = await res
                        .json()
                        .catch(async () => ({ status: res.status, text: await res.text() }));
                    notifyApiError(JSON.stringify(payload), 'Błąd usuwania efektu');
                    throw new Error('delete failed');
                }
                if (editingId === id) resetForm();
                await reload();
            },
        });
    }

    return (
        <div className="grid gap-3">
            {/* Lista */}
            <div className="grid gap-2">
                {list.map((e) => (
                    <div key={e.id} className="rounded-xl border border-zinc-800 p-3">
                        <div className="flex items-center justify-between">
                            <div className="font-medium">
                                {e.name}{' '}
                                <span className="text-xs text-zinc-400">[{e.kind}]</span>
                            </div>
                            <div className="text-xs text-zinc-400">
                                {e.requiresValue ? 'X' : ''}
                            </div>
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">{e.description}</div>
                        <div className="mt-2 flex gap-3">
                            <button className="text-xs" onClick={() => startEdit(e)}>
                                Edytuj
                            </button>
                            <button className="text-xs text-red-300" onClick={() => void del(e.id)}>
                                Usuń
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Formularz */}
            <div className="rounded-xl border border-zinc-800 p-3">
                <div className="text-sm font-medium">
                    {editingId ? 'Edytuj efekt' : 'Nowy efekt'}
                </div>

                <label className="block mt-2 text-xs text-zinc-400">Nazwa</label>
                <input
                    className="w-full vault-input px-3 py-2 text-sm"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                <label className="block mt-2 text-xs text-zinc-400">Rodzaj</label>
                <select
                    className="w-full vault-input px-3 py-2 text-sm"
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value as EffectKind })}
                >
                    <option value="WEAPON">Efekt broni</option>
                    <option value="CRITICAL">Efekt krytyczny</option>
                </select>

                <label className="block mt-2 text-xs text-zinc-400">
                    Opis (użyj X jako zmiennej)
                </label>
                <textarea
                    rows={3}
                    className="w-full vault-input px-3 py-2 text-sm"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                />

                <label className="mt-2 inline-flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={form.requiresValue}
                        onChange={(e) => setForm({ ...form, requiresValue: e.target.checked })}
                    />
                    Wymaga wartości (X)
                </label>

                <div className="mt-3 flex gap-2">
                    <button
                        className="flex-1 h-10 rounded-xl border border-zinc-700"
                        onClick={resetForm}
                    >
                        Wyczyść
                    </button>
                    <button
                        className="flex-1 h-10 rounded-xl bg-emerald-500 text-emerald-950 font-semibold"
                        onClick={() => void save()}
                    >
                        Zapisz
                    </button>
                </div>
            </div>
        </div>
    );
}
