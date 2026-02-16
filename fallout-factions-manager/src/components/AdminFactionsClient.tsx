'use client';

import { useState } from 'react';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';

export type FactionLimit = { tag: string; tier1?: number | null; tier2?: number | null; tier3?: number | null };
export type Faction = { id: string; name: string; limits: FactionLimit[] };
type FormState = { id?: string; name: string; limits: FactionLimit[] };

export function AdminFactionsClient({ initial }: { initial: Faction[] }) {
    const [list, setList] = useState<Faction[]>(initial);
    const [form, setForm] = useState<FormState>({ name: '', limits: [] });
    const [saving, setSaving] = useState(false);

    async function reloadList() {
        const res = await fetch('/api/admin/factions', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch factions');
        const data = (await res.json()) as Faction[];
        setList(data);
    }

    async function save() {
        setSaving(true);
        try {
            // simple client-side validation
            if (!form.name.trim()) {
                notifyWarning('Enter faction name');
                return;
            }
            for (const l of form.limits) {
                if (!l.tag.trim()) {
                    notifyWarning('Each limit must have a tag');
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
                notifyApiError(JSON.stringify(payload), 'Failed to save faction');
                return;
            }

            await reloadList();
            setForm({ name: '', limits: [] }); // exit edit mode
        } finally {
            setSaving(false);
        }
    }

    async function del(id: string) {
        confirmAction({
            title: 'Delete faction? This action cannot be undone.',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onOk: async () => {
                const res = await fetch(`/api/admin/factions/${id}`, { method: 'DELETE' });
                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    notifyApiError(JSON.stringify(payload), 'Failed to delete faction');
                    throw new Error('delete failed');
                }
                await reloadList();
                if (form.id === id) setForm({ name: '', limits: [] });
            },
        });
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
            <h1 className="text-lg font-semibold">Factions (admin)</h1>

            <div className="mt-4 vault-panel p-3">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{form.id ? 'Edit faction' : 'New faction'}</div>
                    {form.id ? (
                        <button onClick={() => setForm({ name: '', limits: [] })} className="text-xs text-zinc-300">
                            New faction
                        </button>
                    ) : null}
                </div>

                <label className="mt-2 block text-xs text-zinc-400">Name</label>
                <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full vault-input px-3 py-2 text-sm outline-none"
                />

                <div className="mt-3">
                    <div className="mb-1 text-xs text-zinc-400">Limits</div>

                    {form.limits.map((l, i) => (
                        <div key={i} className="mb-2 rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
                                <input
                                    value={l.tag}
                                    onChange={(e) => updateLimit(i, { tag: e.target.value })}
                                    placeholder="Limit tag (e.g. CHAMPION / ELITE SUPPORT)"
                                    className="vault-input px-2 py-1 text-sm sm:col-span-6"
                                />
                                <div className="grid grid-cols-3 gap-2 sm:col-span-5">
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
                                </div>
                                <button onClick={() => removeLimit(i)} className="justify-self-end text-xs text-red-300 sm:col-span-1">
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={() => setForm({ ...form, limits: [...form.limits, { tag: '', tier1: null, tier2: null, tier3: null }] })}
                        className="mt-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    >
                        Add limit
                    </button>
                </div>

                <div className="mt-3 flex gap-2">
                    <button onClick={() => setForm({ name: '', limits: [] })} className="h-10 flex-1 rounded-xl border border-zinc-700">
                        Clear
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="h-10 flex-1 rounded-xl bg-emerald-500 font-semibold text-emerald-950 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            <div className="mt-3 grid gap-2">
                {list.map((f) => (
                    <div key={f.id} className="vault-panel p-3">
                        <button onClick={() => setForm({ id: f.id, name: f.name, limits: f.limits })} className="w-full text-left" title="Edit">
                            <div className="flex items-center justify-between">
                                <div className="font-medium">{f.name}</div>
                                <div className="text-xs text-zinc-400">{f.limits.length} limit(s)</div>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                                {f.limits.length === 0 ? (
                                    <span className="text-zinc-500">No limits</span>
                                ) : (
                                    f.limits.map((l, idx) => (
                                        <span key={`${l.tag}_${idx}`} className="inline-flex max-w-full items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-0.5">
                                            <span className="max-w-[16rem] break-words text-zinc-300">{l.tag}</span>
                                            <span className="shrink-0 text-zinc-500">
                                                {l.tier1 ?? '-'} / {l.tier2 ?? '-'} / {l.tier3 ?? '-'}
                                            </span>
                                        </span>
                                    ))
                                )}
                            </div>
                        </button>
                        <div className="mt-2">
                            <button onClick={() => del(f.id)} className="text-xs text-red-300">
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
