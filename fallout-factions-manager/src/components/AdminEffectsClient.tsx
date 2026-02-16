'use client';

import { FilterOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { FilterBar, SortSelect, type ActiveFilterChip } from '@/components/ui/filters';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/antd/ScreenStates';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';

export type EffectKind = 'WEAPON' | 'CRITICAL';

export interface Effect {
    id: string;
    name: string;
    kind: EffectKind;
    description: string;
    requiresValue: boolean;
}

// Keep edited effect id separate from form fields.
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

    // list controls
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [q, setQ] = useState('');
    const [kindFilter, setKindFilter] = useState<'ALL' | EffectKind>('ALL');
    const [sort, setSort] = useState<'NAME:ASC' | 'NAME:DESC' | 'KIND:ASC' | 'KIND:DESC'>('NAME:ASC');
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    const filteredSorted = useMemo(() => {
        const query = q.trim().toLowerCase();
        let arr = list;
        if (query) arr = arr.filter((e) => (e.name + ' ' + e.description).toLowerCase().includes(query));
        if (kindFilter !== 'ALL') arr = arr.filter((e) => e.kind === kindFilter);

        const [k, d] = sort.split(':') as ['NAME' | 'KIND', 'ASC' | 'DESC'];
        const dir = d === 'ASC' ? 1 : -1;
        const cmp = (a: Effect, b: Effect) => {
            if (k === 'KIND') return a.kind.localeCompare(b.kind, 'en') * dir || a.name.localeCompare(b.name, 'en');
            return a.name.localeCompare(b.name, 'en') * dir;
        };
        return [...arr].sort(cmp);
    }, [list, q, kindFilter, sort]);

    const chips: ActiveFilterChip[] = [
        ...(q ? [{ key: 'q', label: `Search: ${q}`, onRemove: () => setQ('') }] : []),
        ...(kindFilter !== 'ALL' ? [{ key: 'kind', label: `Type: ${kindFilter}`, onRemove: () => setKindFilter('ALL') }] : []),
        ...(sort !== 'NAME:ASC' ? [{ key: 'sort', label: `Sort: ${sort}`, onRemove: () => setSort('NAME:ASC') }] : []),
    ];

    const clearAll = () => {
        setQ('');
        setKindFilter('ALL');
        setSort('NAME:ASC');
    };

    async function reload(): Promise<void> {
        setLoading(true);
        setListError(null);
        const res = await fetch('/api/admin/effects', { cache: 'no-store' });
        if (!res.ok) {
            const msg = 'Failed to fetch effects. Refresh the view and try again.';
            setListError(msg);
            notifyApiError(msg);
            setLoading(false);
            return;
        }
        const data: Effect[] = await res.json();
        setList(data);
        setLoading(false);
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
            notifyWarning('Enter effect name');
            return;
        }
        if (!form.description.trim()) {
            notifyWarning('Enter effect description');
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
            notifyApiError(JSON.stringify(payload), 'Error saving effect');
            return;
        }

        resetForm();
        await reload();
    }

    async function del(id: string): Promise<void> {
        confirmAction({
            title: 'Delete effect?',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onOk: async () => {
                const res = await fetch(`/api/admin/effects/${id}`, { method: 'DELETE' });
                if (!res.ok) {
                    const payload = await res
                        .json()
                        .catch(async () => ({ status: res.status, text: await res.text() }));
                    notifyApiError(JSON.stringify(payload), 'Error deleting effect');
                    throw new Error('delete failed');
                }
                if (editingId === id) resetForm();
                await reload();
            },
        });
    }

    return (
        <div className="grid gap-3">
            <div className="vault-panel p-3">
                <p className="ff-panel-headline">Admin / Effects</p>
                <p className="text-sm vault-muted">
                    Define weapon and critical effects that can be attached to loadout profiles.
                </p>
            </div>

            {/* Form */}
            <div className="vault-panel p-3">
                <div className="text-sm font-medium">
                    {editingId ? 'Edit effect' : 'New effect'}
                </div>

                <label className="block mt-2 text-xs text-zinc-400">Name</label>
                <input
                    className="w-full vault-input px-3 py-2 text-sm"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                <label className="block mt-2 text-xs text-zinc-400">Type</label>
                <select
                    className="w-full vault-input px-3 py-2 text-sm"
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value as EffectKind })}
                >
                    <option value="WEAPON">Weapon effect</option>
                    <option value="CRITICAL">Critical effect</option>
                </select>

                <label className="block mt-2 text-xs text-zinc-400">
                    Description (use X as variable)
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
                    Requires value (X)
                </label>

                <div className="mt-3 flex gap-2">
                    <button
                        className="flex-1 h-10 rounded-xl border border-zinc-700"
                        onClick={resetForm}
                    >
                        Clear</button>
                    <button
                        className="flex-1 h-10 rounded-xl bg-emerald-500 text-emerald-950 font-semibold"
                        onClick={() => void save()}
                    >
                        Save
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="grid gap-2">
                <div className="vault-panel p-3">
                    <div>
                        <div className="text-sm font-medium">Effects list</div>
                        <div className="mt-0.5 text-[11px] text-zinc-400">
                            Results: <span className="font-semibold text-zinc-200">{filteredSorted.length}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setFiltersOpen(true)}
                            className={
                                'grid h-9 w-9 place-items-center rounded-xl border ' +
                                (chips.length > 0
                                    ? 'border-amber-300/50 bg-amber-300/10 text-amber-100'
                                    : 'border-zinc-700 bg-zinc-900 text-zinc-200')
                            }
                            aria-label="Filters"
                            title="Filters"
                        >
                            <FilterOutlined />
                        </button>
                        <button
                            type="button"
                            onClick={() => void reload()}
                            className="h-9 vault-input px-3 text-xs text-zinc-300"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <FilterBar
                    showTrigger={false}
                    open={filtersOpen}
                    onOpenChangeAction={setFiltersOpen}
                    search={q}
                    onSearchAction={setQ}
                    searchPlaceholder="Search effect..."
                    controls={
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <select
                                value={kindFilter}
                                onChange={(e) => setKindFilter(e.target.value as 'ALL' | EffectKind)}
                                className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                            >
                                <option value="ALL">Type: all</option>
                                <option value="WEAPON">Type: WEAPON</option>
                                <option value="CRITICAL">Type: CRITICAL</option>
                            </select>
                            <SortSelect
                                value={sort}
                                onChange={(v) => setSort(v as typeof sort)}
                                options={[
                                    { value: 'NAME:ASC', label: 'Sort: name A-Z' },
                                    { value: 'NAME:DESC', label: 'Sort: name Z-A' },
                                    { value: 'KIND:ASC', label: 'Sort: type A-Z' },
                                    { value: 'KIND:DESC', label: 'Sort: type Z-A' },
                                ]}
                            />
                        </div>
                    }
                    activeChips={chips}
                    onClearAllAction={clearAll}
                />

                {loading ? <LoadingState /> : null}
                {!loading && listError ? <ErrorState description={listError} onRetry={() => void reload()} /> : null}
                {!loading && !listError && filteredSorted.length === 0 ? (
                    <EmptyState title="No effects" description="Add your first effect or clear filters." />
                ) : null}
                {!loading && !listError && filteredSorted.map((e) => (
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
                                Edit
                            </button>
                            <button className="text-xs text-red-300" onClick={() => void del(e.id)}>
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
