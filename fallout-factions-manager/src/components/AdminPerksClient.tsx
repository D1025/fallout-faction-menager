'use client';

import { FilterOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/antd/ScreenStates';
import { FilterBar, SortSelect, type ActiveFilterChip } from '@/components/ui/filters';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';

type Behavior = 'NONE' | 'COMPANION_ROBOT' | 'COMPANION_BEAST';
type StatKeySpecial = 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L';

type Perk = {
    id: string;
    name: string;
    description: string;
    // requiresValue is intentionally hidden in UI; backend may still support it.
    startAllowed: boolean;
    behavior: Behavior;
    statKey: StatKeySpecial | null;
    minValue: number | null;
    isInnate: boolean;
    category: 'REGULAR' | 'AUTOMATRON';
};

type PerkForm = Omit<Perk, 'id'>;
type SortKey = 'NAME' | 'CATEGORY' | 'INNATE' | 'START_ALLOWED';
type CategoryFilter = 'ALL' | 'REGULAR' | 'AUTOMATRON';
type AvailabilityFilter = 'ALL' | 'INNATE' | 'NON_INNATE';

export function AdminPerksClient() {
    const [list, setList] = useState<Perk[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState<PerkForm>({
        name: '',
        description: '',
        startAllowed: false,
        behavior: 'NONE',
        statKey: null,
        minValue: null,
        isInnate: false,
        category: 'REGULAR',
    });

    const [q, setQ] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
    const [availability, setAvailability] = useState<AvailabilityFilter>('ALL');
    const [sortKey, setSortKey] = useState<SortKey>('NAME');
    const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

    const [pageSize, setPageSize] = useState<number>(20);
    const [page, setPage] = useState<number>(1);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    async function reload() {
        setLoading(true);
        setListError(null);

        const res = await fetch('/api/admin/perks', { cache: 'no-store' });
        if (!res.ok) {
            setListError('Failed to fetch perks. Refresh and try again.');
            setLoading(false);
            return;
        }

        setList(await res.json());
        setLoading(false);
    }

    useEffect(() => {
        void reload();
    }, []);

    // Reset to first page when filters/sort/page size changes.
    useEffect(() => {
        setPage(1);
    }, [q, categoryFilter, availability, sortKey, sortDir, pageSize]);

    function reset() {
        setEditingId(null);
        setForm({
            name: '',
            description: '',
            startAllowed: false,
            behavior: 'NONE',
            statKey: null,
            minValue: null,
            isInnate: false,
            category: 'REGULAR',
        });
    }

    async function save() {
        if (!form.name.trim() || !form.description.trim()) {
            notifyWarning('Fill in name and description');
            return;
        }

        const method: 'POST' | 'PATCH' = editingId ? 'PATCH' : 'POST';
        const url = editingId ? `/api/admin/perks/${editingId}` : '/api/admin/perks';

        // requiresValue is intentionally not sent from this UI.
        const payload = {
            ...form,
            name: form.name.trim(),
            description: form.description.trim(),
        };

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const t = await res.text().catch(() => '');
            notifyApiError(t || 'Error saving perk');
            return;
        }

        reset();
        await reload();
    }

    async function del(id: string) {
        confirmAction({
            title: 'Delete perk?',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onOk: async () => {
                const res = await fetch(`/api/admin/perks/${id}`, { method: 'DELETE' });
                if (!res.ok) {
                    notifyApiError('Error deleting perk');
                    throw new Error('delete failed');
                }
                if (editingId === id) reset();
                await reload();
            },
        });
    }

    const reqLabel = (p: Pick<Perk, 'statKey' | 'minValue'>) => {
        if (!p.statKey || p.minValue == null) return null;
        return `${p.statKey} >= ${p.minValue}`;
    };

    const filteredSorted = useMemo(() => {
        const query = q.trim().toLowerCase();
        let arr = list;

        if (query) {
            arr = arr.filter((p) => (p.name + ' ' + p.description).toLowerCase().includes(query));
        }

        if (categoryFilter !== 'ALL') {
            arr = arr.filter((p) => p.category === categoryFilter);
        }

        if (availability === 'INNATE') arr = arr.filter((p) => p.isInnate);
        if (availability === 'NON_INNATE') arr = arr.filter((p) => !p.isInnate);

        const dir = sortDir === 'ASC' ? 1 : -1;
        const cmp = (a: Perk, b: Perk) => {
            if (sortKey === 'NAME') return a.name.localeCompare(b.name, 'en') * dir;
            if (sortKey === 'CATEGORY') return a.category.localeCompare(b.category, 'en') * dir || a.name.localeCompare(b.name, 'en');
            if (sortKey === 'INNATE') return (Number(a.isInnate) - Number(b.isInnate)) * dir || a.name.localeCompare(b.name, 'en');
            return (Number(a.startAllowed) - Number(b.startAllowed)) * dir || a.name.localeCompare(b.name, 'en');
        };

        return [...arr].sort(cmp);
    }, [list, q, categoryFilter, availability, sortKey, sortDir]);

    const total = filteredSorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);

    const pageItems = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredSorted.slice(start, start + pageSize);
    }, [filteredSorted, safePage, pageSize]);

    useEffect(() => {
        if (safePage !== page) setPage(safePage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [safePage]);

    const chips: ActiveFilterChip[] = [
        ...(q ? [{ key: 'q', label: `Search: ${q}`, onRemove: () => setQ('') }] : []),
        ...(categoryFilter !== 'ALL' ? [{ key: 'category', label: `Category: ${categoryFilter}`, onRemove: () => setCategoryFilter('ALL') }] : []),
        ...(availability !== 'ALL' ? [{ key: 'availability', label: `Availability: ${availability}`, onRemove: () => setAvailability('ALL') }] : []),
    ];

    const clearAll = () => {
        setQ('');
        setCategoryFilter('ALL');
        setAvailability('ALL');
        setSortKey('NAME');
        setSortDir('ASC');
        setPageSize(20);
    };

    return (
        <div className="grid gap-3">
            <div className="vault-panel p-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{editingId ? 'Edit perk' : 'Add perk'}</div>
                    {editingId ? (
                        <button type="button" onClick={reset} className="h-9 vault-input px-3 text-xs text-zinc-300">
                            Cancel edit
                        </button>
                    ) : null}
                </div>

                <div className="mt-3 grid gap-3">
                    <div>
                        <label className="block text-xs text-zinc-400">Name</label>
                        <input
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="mt-1 w-full vault-input px-3 py-2 text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400">Description</label>
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="mt-1 w-full vault-input px-3 py-2 text-sm"
                        />
                        <div className="mt-1 text-[11px] text-zinc-500">
                            You can use X as a variable in description text. The &quot;requires value&quot; field is hidden in this UI.
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="inline-flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={form.startAllowed} onChange={(e) => setForm({ ...form, startAllowed: e.target.checked })} />
                            Available at start
                        </label>

                        <label className="inline-flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={form.isInnate} onChange={(e) => setForm({ ...form, isInnate: e.target.checked })} />
                            INNATE (template-only)
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs text-zinc-400">Required SPECIAL (optional)</label>
                            <select
                                value={form.statKey ?? ''}
                                onChange={(e) => setForm((f) => ({ ...f, statKey: e.target.value ? (e.target.value as StatKeySpecial) : null }))}
                                className="mt-1 w-full vault-input px-3 py-2 text-sm"
                            >
                                <option value="">none</option>
                                {(['S', 'P', 'E', 'C', 'I', 'A', 'L'] as StatKeySpecial[]).map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-400">Min value (optional)</label>
                            <input
                                inputMode="numeric"
                                value={form.minValue ?? ''}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    setForm((f) => ({
                                        ...f,
                                        minValue: raw === '' ? null : Number.isFinite(Number(raw)) ? Number(raw) : f.minValue,
                                    }));
                                }}
                                className="mt-1 w-full vault-input px-3 py-2 text-sm"
                                placeholder="e.g. 5"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400">Behavior</label>
                        <select
                            value={form.behavior}
                            onChange={(e) => setForm({ ...form, behavior: e.target.value as Behavior })}
                            className="mt-1 w-full vault-input px-3 py-2 text-sm"
                        >
                            <option value="NONE">None</option>
                            <option value="COMPANION_ROBOT">Robot controller</option>
                            <option value="COMPANION_BEAST">Beast controller</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400">Category</label>
                        <select
                            value={form.category}
                            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as 'REGULAR' | 'AUTOMATRON' }))}
                            className="mt-1 w-full vault-input px-3 py-2 text-sm"
                        >
                            <option value="REGULAR">Regular</option>
                            <option value="AUTOMATRON">Automatron Perk</option>
                        </select>
                        <div className="mt-1 text-[11px] text-zinc-500">
                            Automatron perks can be added in army view only when the unit has INNATE perk <b>ALL THE TOYS</b>.
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button type="button" onClick={reset} className="h-10 flex-1 vault-input text-sm text-zinc-200">
                            Clear
                        </button>
                        <button type="button" onClick={() => void save()} className="h-10 flex-1 rounded-xl bg-emerald-500 text-sm font-semibold text-emerald-950">
                            {editingId ? 'Save changes' : 'Add'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="vault-panel p-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="text-sm font-medium">Perk list</div>
                        <div className="mt-0.5 text-[11px] text-zinc-400">
                            Results: <span className="font-semibold text-zinc-200">{total}</span>
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
                        <button type="button" onClick={() => void reload()} className="h-9 vault-input px-3 text-xs text-zinc-300">
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
                    searchPlaceholder="Search by name/description..."
                    controls={
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                                className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                            >
                                <option value="ALL">Category: all</option>
                                <option value="REGULAR">Category: regular</option>
                                <option value="AUTOMATRON">Category: automatron</option>
                            </select>
                            <select
                                value={availability}
                                onChange={(e) => setAvailability(e.target.value as AvailabilityFilter)}
                                className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                            >
                                <option value="ALL">Availability: all</option>
                                <option value="INNATE">Availability: INNATE</option>
                                <option value="NON_INNATE">Availability: non-INNATE</option>
                            </select>
                            <SortSelect
                                value={`${sortKey}:${sortDir}`}
                                onChange={(next) => {
                                    const [k, d] = next.split(':') as [SortKey, 'ASC' | 'DESC'];
                                    setSortKey(k);
                                    setSortDir(d);
                                }}
                                options={[
                                    { value: 'NAME:ASC', label: 'Sort: name A-Z' },
                                    { value: 'NAME:DESC', label: 'Sort: name Z-A' },
                                    { value: 'CATEGORY:ASC', label: 'Sort: category A-Z' },
                                    { value: 'CATEGORY:DESC', label: 'Sort: category Z-A' },
                                    { value: 'INNATE:ASC', label: 'Sort: INNATE ascending' },
                                    { value: 'INNATE:DESC', label: 'Sort: INNATE descending' },
                                    { value: 'START_ALLOWED:ASC', label: 'Sort: start-allowed ascending' },
                                    { value: 'START_ALLOWED:DESC', label: 'Sort: start-allowed descending' },
                                ]}
                            />
                        </div>
                    }
                    moreFilters={
                        <label className="block text-xs text-zinc-300">
                            Per page
                            <select
                                value={String(pageSize)}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="mt-1 h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                            >
                                {[10, 20, 50, 100].map((n) => (
                                    <option key={n} value={String(n)}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                        </label>
                    }
                    activeChips={chips}
                    onClearAllAction={clearAll}
                />

                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-400">
                    <div>
                        Page <span className="font-semibold text-zinc-200">{safePage}</span> / {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setPage(1)} disabled={safePage === 1} className="h-9 vault-input px-3 disabled:opacity-40">
                            {'<<'}
                        </button>
                        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="h-9 vault-input px-3 disabled:opacity-40">
                            {'<'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="h-9 vault-input px-3 disabled:opacity-40"
                        >
                            {'>'}
                        </button>
                        <button type="button" onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="h-9 vault-input px-3 disabled:opacity-40">
                            {'>>'}
                        </button>
                    </div>
                </div>

                <div className="mt-3 grid gap-2">
                    {loading ? <LoadingState title="Loading perks" /> : null}
                    {!loading && listError ? <ErrorState description={listError} onRetry={() => void reload()} /> : null}
                    {!loading &&
                        !listError &&
                        pageItems.map((p) => (
                            <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="truncate font-medium">{p.name}</div>
                                            {p.category === 'AUTOMATRON' ? (
                                                <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-200">
                                                    AUTOMATRON
                                                </span>
                                            ) : (
                                                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-zinc-200">REGULAR</span>
                                            )}
                                            {p.isInnate ? (
                                                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                                                    INNATE
                                                </span>
                                            ) : null}
                                            {p.startAllowed ? (
                                                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">START</span>
                                            ) : null}
                                            {reqLabel(p) ? (
                                                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-200">{reqLabel(p)}</span>
                                            ) : null}
                                        </div>
                                        <div className="mt-1 text-[11px] text-zinc-400">{p.behavior}</div>
                                        <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{p.description}</div>
                                    </div>

                                    <div className="shrink-0 flex flex-col gap-2">
                                        <button
                                            type="button"
                                            className="h-9 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                                            onClick={() => {
                                                setEditingId(p.id);
                                                setForm({
                                                    name: p.name,
                                                    description: p.description,
                                                    startAllowed: p.startAllowed,
                                                    behavior: p.behavior,
                                                    statKey: p.statKey ?? null,
                                                    minValue: p.minValue ?? null,
                                                    isInnate: p.isInnate ?? false,
                                                    category: (p.category ?? 'REGULAR') as 'REGULAR' | 'AUTOMATRON',
                                                });
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="h-9 rounded-xl border border-red-700/60 bg-red-900/20 px-3 text-xs text-red-200"
                                            onClick={() => void del(p.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                    {!loading && !listError && pageItems.length === 0 ? <EmptyState title="No results" description="No perks match active filters." /> : null}
                </div>
            </div>
        </div>
    );
}
