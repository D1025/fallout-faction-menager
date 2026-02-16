'use client';

import { useEffect, useMemo, useState } from 'react';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';
import { RuleDescription } from '@/components/rules/RuleDescription';

type RuleDef = {
    id: string;
    name: string;
    description: string;
    sortOrder: number;
};

type RuleKind = 'FACILITIES' | 'HAZARDS';

type FormState = {
    name: string;
    sortOrder: number;
    description: string;
};

const emptyForm: FormState = {
    name: '',
    sortOrder: 0,
    description: '',
};

export function AdminHomeTurfClient() {
    const [active, setActive] = useState<RuleKind>('FACILITIES');
    const [facilities, setFacilities] = useState<RuleDef[]>([]);
    const [hazards, setHazards] = useState<RuleDef[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [form, setForm] = useState<FormState>(emptyForm);

    const activeList = active === 'FACILITIES' ? facilities : hazards;
    const basePath = active === 'FACILITIES' ? '/api/admin/home-turf/facilities' : '/api/admin/home-turf/hazards';
    const activeLabel = active === 'FACILITIES' ? 'Facility' : 'Hazard';

    const filtered = useMemo(() => {
        const query = q.trim().toLowerCase();
        if (!query) return activeList;
        return activeList.filter((item) =>
            (item.name + ' ' + item.description).toLowerCase().includes(query),
        );
    }, [activeList, q]);

    async function reload() {
        setLoading(true);
        try {
            const [facRes, hazRes] = await Promise.all([
                fetch('/api/admin/home-turf/facilities', { cache: 'no-store' }),
                fetch('/api/admin/home-turf/hazards', { cache: 'no-store' }),
            ]);
            if (!facRes.ok || !hazRes.ok) throw new Error();

            const [facData, hazData] = (await Promise.all([facRes.json(), hazRes.json()])) as [
                RuleDef[],
                RuleDef[],
            ];
            setFacilities(facData);
            setHazards(hazData);
        } catch {
            notifyApiError('Failed to load Home Turf dictionaries');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void reload();
    }, []);

    function resetForm() {
        setEditingId(null);
        setForm(emptyForm);
    }

    function startEdit(item: RuleDef) {
        setEditingId(item.id);
        setForm({
            name: item.name,
            description: item.description,
            sortOrder: item.sortOrder,
        });
    }

    async function save() {
        const name = form.name.trim();
        const description = form.description.trim();

        if (!name) {
            notifyWarning(`${activeLabel} name is required`);
            return;
        }
        if (!description) {
            notifyWarning('Description is required');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(editingId ? `${basePath}/${editingId}` : basePath, {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description,
                    sortOrder: Math.max(0, Math.floor(form.sortOrder || 0)),
                }),
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                throw new Error(txt || 'save failed');
            }

            resetForm();
            await reload();
        } catch (err) {
            notifyApiError(err, `Failed to save ${activeLabel.toLowerCase()}`);
        } finally {
            setSaving(false);
        }
    }

    async function remove(id: string) {
        confirmAction({
            title: `Delete ${activeLabel.toLowerCase()}?`,
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onOk: async () => {
                const res = await fetch(`${basePath}/${id}`, { method: 'DELETE' });
                if (!res.ok) {
                    const txt = await res.text().catch(() => '');
                    notifyApiError(txt || `Failed to delete ${activeLabel.toLowerCase()}`);
                    throw new Error('delete failed');
                }
                if (editingId === id) resetForm();
                await reload();
            },
        });
    }

    return (
        <div className="grid gap-3">
            <section className="vault-panel p-3">
                <p className="ff-panel-headline">Admin / Home Turf</p>
                <p className="text-sm vault-muted">
                    Manage hazard and facility dictionaries used by armies in Home Turf.
                </p>
            </section>

            <section className="vault-panel p-3">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => {
                            setActive('FACILITIES');
                            resetForm();
                        }}
                        className={
                            'h-10 rounded-xl border text-xs font-medium ' +
                            (active === 'FACILITIES'
                                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                                : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                        }
                    >
                        Facilities
                    </button>
                    <button
                        onClick={() => {
                            setActive('HAZARDS');
                            resetForm();
                        }}
                        className={
                            'h-10 rounded-xl border text-xs font-medium ' +
                            (active === 'HAZARDS'
                                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                                : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                        }
                    >
                        Hazards
                    </button>
                </div>
            </section>

            <section className="vault-panel p-3">
                <div className="text-sm font-medium">{editingId ? `Edit ${activeLabel}` : `New ${activeLabel}`}</div>

                <label className="mt-2 block text-xs text-zinc-400">Name</label>
                <input
                    className="w-full vault-input px-3 py-2 text-sm"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder={`${activeLabel} name`}
                />

                <label className="mt-2 block text-xs text-zinc-400">Sort order</label>
                <input
                    className="w-full vault-input px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={form.sortOrder}
                    onChange={(e) =>
                        setForm((prev) => ({ ...prev, sortOrder: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0 }))
                    }
                />

                <label className="mt-2 block text-xs text-zinc-400">
                    Description (supports markdown tables)
                </label>
                <textarea
                    rows={8}
                    className="w-full vault-input px-3 py-2 text-sm"
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />

                <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                    <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-zinc-500">Preview</div>
                    <RuleDescription text={form.description} />
                </div>

                <div className="mt-3 flex gap-2">
                    <button className="h-10 flex-1 rounded-xl border border-zinc-700" onClick={resetForm}>
                        Clear
                    </button>
                    <button
                        className="h-10 flex-1 rounded-xl bg-emerald-500 font-semibold text-emerald-950 disabled:opacity-50"
                        onClick={() => void save()}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </section>

            <section className="vault-panel p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                        {activeLabel} list ({filtered.length})
                    </div>
                    <button
                        className="h-9 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs"
                        onClick={() => void reload()}
                    >
                        Refresh
                    </button>
                </div>

                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={`Search ${activeLabel.toLowerCase()}...`}
                    className="mb-3 h-9 w-full vault-input px-3 text-sm"
                />

                {loading ? <div className="text-xs text-zinc-400">Loading...</div> : null}
                {!loading && filtered.length === 0 ? <div className="text-xs text-zinc-500">No entries.</div> : null}

                <div className="grid gap-2">
                    {filtered.map((item) => (
                        <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="font-medium text-zinc-100">{item.name}</div>
                                <div className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">
                                    Order: {item.sortOrder}
                                </div>
                            </div>
                            <div className="mt-2">
                                <RuleDescription text={item.description} />
                            </div>
                            <div className="mt-2 flex gap-3">
                                <button className="text-xs" onClick={() => startEdit(item)}>
                                    Edit
                                </button>
                                <button className="text-xs text-red-300" onClick={() => void remove(item.id)}>
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

