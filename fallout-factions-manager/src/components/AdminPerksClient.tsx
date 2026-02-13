'use client';

import { ClearOutlined, FilterOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';
import { FilterBar, SortSelect, type ActiveFilterChip } from '@/components/ui/filters';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/antd/ScreenStates';

type Behavior = 'NONE' | 'COMPANION_ROBOT' | 'COMPANION_BEAST';
type StatKeySpecial = 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L';

type Perk = {
    id: string;
    name: string;
    description: string;
    // requiresValue usuwamy z UI (backend nadal może mieć pole)
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

    // list controls
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
            setListError('Nie udało się pobrać perków. Odśwież stronę i spróbuj ponownie.');
            setLoading(false);
            return;
        }
        setList(await res.json());
        setLoading(false);
    }
    useEffect(() => {
        void reload();
    }, []);

    // przy zmianie filtrów wracamy na 1 stronę
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
            notifyWarning('Uzupełnij nazwę i opis');
            return;
        }
        const method: 'POST' | 'PATCH' = editingId ? 'PATCH' : 'POST';
        const url = editingId ? `/api/admin/perks/${editingId}` : '/api/admin/perks';

        // celowo nie wysyłamy requiresValue z UI
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
            notifyApiError(t || 'Błąd zapisu perka');
            return;
        }
        reset();
        await reload();
    }

    async function del(id: string) {
        confirmAction({
            title: 'Usunąć perk?',
            okText: 'Usuń',
            cancelText: 'Anuluj',
            danger: true,
            onOk: async () => {
                const res = await fetch(`/api/admin/perks/${id}`, { method: 'DELETE' });
                if (!res.ok) {
                    notifyApiError('Błąd usuwania perka');
                    throw new Error('delete failed');
                }
                if (editingId === id) reset();
                await reload();
            },
        });
    }

    const reqLabel = (p: Pick<Perk, 'statKey' | 'minValue'>) => {
        if (!p.statKey || p.minValue == null) return null;
        return `${p.statKey} ≥ ${p.minValue}`;
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
            if (sortKey === 'NAME') return a.name.localeCompare(b.name, 'pl') * dir;
            if (sortKey === 'CATEGORY') return a.category.localeCompare(b.category) * dir || a.name.localeCompare(b.name, 'pl');
            if (sortKey === 'INNATE') return (Number(a.isInnate) - Number(b.isInnate)) * dir || a.name.localeCompare(b.name, 'pl');
            return (Number(a.startAllowed) - Number(b.startAllowed)) * dir || a.name.localeCompare(b.name, 'pl');
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
        ...(q ? [{ key: 'q', label: `Szukaj: ${q}`, onRemove: () => setQ('') }] : []),
        ...(categoryFilter !== 'ALL' ? [{ key: 'category', label: `Kategoria: ${categoryFilter}`, onRemove: () => setCategoryFilter('ALL') }] : []),
        ...(availability !== 'ALL' ? [{ key: 'availability', label: `Dostępność: ${availability}`, onRemove: () => setAvailability('ALL') }] : []),
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
            {/* FORMULARZ NA GÓRZE */}
            <div className="vault-panel p-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{editingId ? 'Edytuj perk' : 'Dodaj perk'}</div>
                    {editingId ? (
                        <button
                            type="button"
                            onClick={reset}
                            className="h-9 vault-input px-3 text-xs text-zinc-300"
                        >
                            Anuluj edycję
                        </button>
                    ) : null}
                </div>

                <div className="mt-3 grid gap-3">
                    <div>
                        <label className="block text-xs text-zinc-400">Nazwa</label>
                        <input
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="mt-1 w-full vault-input px-3 py-2 text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400">Opis</label>
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="mt-1 w-full vault-input px-3 py-2 text-sm"
                        />
                        <div className="mt-1 text-[11px] text-zinc-500">
                            W opisie możesz używać X jako zmiennej, ale pole &quot;wymaga wartości&quot; zostało usunięte z UI.
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="inline-flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.startAllowed}
                                onChange={(e) => setForm({ ...form, startAllowed: e.target.checked })}
                            />
                            Do wyboru na starcie
                        </label>

                        <label className="inline-flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.isInnate}
                                onChange={(e) => setForm({ ...form, isInnate: e.target.checked })}
                            />
                            INNATE (tylko do templatek)
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs text-zinc-400">Wymagany SPECIAL (opcjonalnie)</label>
                            <select
                                value={form.statKey ?? ''}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, statKey: e.target.value ? (e.target.value as StatKeySpecial) : null }))
                                }
                                className="mt-1 w-full vault-input px-3 py-2 text-sm"
                            >
                                <option value="">— brak —</option>
                                {(['S', 'P', 'E', 'C', 'I', 'A', 'L'] as StatKeySpecial[]).map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-400">Min. wartość (opcjonalnie)</label>
                            <input
                                inputMode="numeric"
                                value={form.minValue ?? ''}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    setForm((f) => ({
                                        ...f,
                                        minValue:
                                            raw === ''
                                                ? null
                                                : Number.isFinite(Number(raw))
                                                    ? Number(raw)
                                                    : f.minValue,
                                    }));
                                }}
                                className="mt-1 w-full vault-input px-3 py-2 text-sm"
                                placeholder="np. 5"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400">Zachowanie</label>
                        <select
                            value={form.behavior}
                            onChange={(e) => setForm({ ...form, behavior: e.target.value as Behavior })}
                            className="mt-1 w-full vault-input px-3 py-2 text-sm"
                        >
                            <option value="NONE">Brak</option>
                            <option value="COMPANION_ROBOT">Kontroler robota</option>
                            <option value="COMPANION_BEAST">Kontroler zwierzaka</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400">Kategoria</label>
                        <select
                            value={form.category}
                            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as 'REGULAR' | 'AUTOMATRON' }))}
                            className="mt-1 w-full vault-input px-3 py-2 text-sm"
                        >
                            <option value="REGULAR">Regular</option>
                            <option value="AUTOMATRON">Automatron Perk</option>
                        </select>
                        <div className="mt-1 text-[11px] text-zinc-500">
                            Automatron Perks są dostępne do dodania w armii tylko jeśli jednostka ma INNATE perk <b>ALL THE TOYS</b>.
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={reset}
                            className="h-10 flex-1 vault-input text-sm text-zinc-200"
                        >
                            Wyczyść
                        </button>
                        <button
                            type="button"
                            onClick={() => void save()}
                            className="h-10 flex-1 rounded-xl bg-emerald-500 text-sm font-semibold text-emerald-950"
                        >
                            {editingId ? 'Zapisz zmiany' : 'Dodaj'}
                        </button>
                    </div>
                </div>
            </div>

            {/* LISTA NA DOLE */}
            <div className="vault-panel p-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="text-sm font-medium">Lista perków</div>
                        <div className="mt-0.5 text-[11px] text-zinc-400">
                            Wyniki: <span className="font-semibold text-zinc-200">{total}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setFiltersOpen(true)}
                            className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200"
                            aria-label="Filtry"
                            title="Filtry"
                        >
                            <FilterOutlined />
                        </button>
                        <button
                            type="button"
                            onClick={clearAll}
                            className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200"
                            aria-label="Wyczyść filtry"
                            title="Wyczyść filtry"
                        >
                            <ClearOutlined />
                        </button>
                        <button
                            type="button"
                            onClick={() => void reload()}
                            className="h-9 vault-input px-3 text-xs text-zinc-300"
                        >
                            Odśwież
                        </button>
                    </div>
                </div>

                {/* Drawer filtrów (bez kontenera w treści) */}
                <FilterBar
                    showTrigger={false}
                    open={filtersOpen}
                    onOpenChangeAction={setFiltersOpen}
                    search={q}
                    onSearchAction={setQ}
                    searchPlaceholder="Szukaj po nazwie/opisie…"
                    controls={
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                                className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                            >
                                <option value="ALL">Kategoria: wszystkie</option>
                                <option value="REGULAR">Kategoria: regular</option>
                                <option value="AUTOMATRON">Kategoria: automatron</option>
                            </select>
                            <select
                                value={availability}
                                onChange={(e) => setAvailability(e.target.value as AvailabilityFilter)}
                                className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                            >
                                <option value="ALL">Dostępność: wszystkie</option>
                                <option value="INNATE">Dostępność: INNATE</option>
                                <option value="NON_INNATE">Dostępność: nie‑INNATE</option>
                            </select>
                            <SortSelect
                                value={`${sortKey}:${sortDir}`}
                                onChange={(next) => {
                                    const [k, d] = next.split(':') as [SortKey, 'ASC' | 'DESC'];
                                    setSortKey(k);
                                    setSortDir(d);
                                }}
                                options={[
                                    { value: 'NAME:ASC', label: 'Sort: nazwa A→Z' },
                                    { value: 'NAME:DESC', label: 'Sort: nazwa Z→A' },
                                    { value: 'CATEGORY:ASC', label: 'Sort: kategoria A→Z' },
                                    { value: 'CATEGORY:DESC', label: 'Sort: kategoria Z→A' },
                                    { value: 'INNATE:ASC', label: 'Sort: INNATE rosnąco' },
                                    { value: 'INNATE:DESC', label: 'Sort: INNATE malejąco' },
                                    { value: 'START_ALLOWED:ASC', label: 'Sort: startowe rosnąco' },
                                    { value: 'START_ALLOWED:DESC', label: 'Sort: startowe malejąco' },
                                ]}
                            />
                        </div>
                    }
                    moreFilters={
                        <label className="block text-xs text-zinc-300">
                            Na stronę
                            <select
                                value={String(pageSize)}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="mt-1 h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                            >
                                {[10, 20, 50, 100].map((n) => (
                                    <option key={n} value={String(n)}>{n}</option>
                                ))}
                            </select>
                        </label>
                    }
                    activeChips={chips}
                    onClearAllAction={clearAll}
                />

                {/* usunięto: stary kontener filtrów w treści */}

                {/* Paginacja */}
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-400">
                    <div>
                        Strona <span className="font-semibold text-zinc-200">{safePage}</span> / {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setPage(1)}
                            disabled={safePage === 1}
                            className="h-9 vault-input px-3 disabled:opacity-40"
                        >
                            «
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className="h-9 vault-input px-3 disabled:opacity-40"
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="h-9 vault-input px-3 disabled:opacity-40"
                        >
                            ›
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage(totalPages)}
                            disabled={safePage === totalPages}
                            className="h-9 vault-input px-3 disabled:opacity-40"
                        >
                            »
                        </button>
                    </div>
                </div>

                {/* Lista */}
                <div className="mt-3 grid gap-2">
                    {loading ? <LoadingState title="Ładowanie perków" /> : null}
                    {!loading && listError ? <ErrorState description={listError} onRetry={() => void reload()} /> : null}
                    {!loading && !listError && pageItems.map((p) => (
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
                                            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-zinc-200">
                                                REGULAR
                                            </span>
                                        )}
                                        {p.isInnate ? (
                                            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                                                INNATE
                                            </span>
                                        ) : null}
                                        {p.startAllowed ? (
                                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                                                START
                                            </span>
                                        ) : null}
                                        {reqLabel(p) ? (
                                            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-200">
                                                {reqLabel(p)}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-1 text-[11px] text-zinc-400">{p.behavior}</div>
                                    <div className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">{p.description}</div>
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
                                        Edytuj
                                    </button>
                                    <button
                                        type="button"
                                        className="h-9 rounded-xl border border-red-700/60 bg-red-900/20 px-3 text-xs text-red-200"
                                        onClick={() => void del(p.id)}
                                    >
                                        Usuń
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {!loading && !listError && pageItems.length === 0 ? (
                        <EmptyState title="Brak wyników" description="Nie znaleziono perków dla aktywnych filtrów." />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
