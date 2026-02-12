'use client';

import { useEffect, useMemo, useState } from 'react';

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

    async function reload() {
        const res = await fetch('/api/admin/perks', { cache: 'no-store' });
        setList(await res.json());
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
            alert('Uzupełnij nazwę i opis');
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
            alert('Błąd zapisu' + (t ? `: ${t}` : ''));
            return;
        }
        reset();
        await reload();
    }

    async function del(id: string) {
        if (!confirm('Usunąć perk?')) return;
        const res = await fetch(`/api/admin/perks/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            alert('Błąd usuwania');
            return;
        }
        if (editingId === id) reset();
        await reload();
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

    const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
        <button
            type="button"
            onClick={() => {
                if (sortKey === k) setSortDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'));
                else {
                    setSortKey(k);
                    setSortDir('ASC');
                }
            }}
            className={
                'h-9 rounded-full border px-3 text-xs font-medium ' +
                (sortKey === k ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-zinc-700 bg-zinc-950 text-zinc-300')
            }
            title={sortKey === k ? `Sort: ${sortDir}` : 'Sortuj'}
        >
            {label}
            {sortKey === k ? (sortDir === 'ASC' ? ' ↑' : ' ↓') : ''}
        </button>
    );

    return (
        <div className="grid gap-3">
            {/* FORMULARZ NA GÓRZE */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{editingId ? 'Edytuj perk' : 'Dodaj perk'}</div>
                    {editingId ? (
                        <button
                            type="button"
                            onClick={reset}
                            className="h-9 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-300"
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
                            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400">Opis</label>
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
                                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
                                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                                placeholder="np. 5"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400">Zachowanie</label>
                        <select
                            value={form.behavior}
                            onChange={(e) => setForm({ ...form, behavior: e.target.value as Behavior })}
                            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
                            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
                            className="h-10 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 text-sm text-zinc-200"
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
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="text-sm font-medium">Lista perków</div>
                        <div className="mt-0.5 text-[11px] text-zinc-400">
                            Wyniki: <span className="font-semibold text-zinc-200">{total}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void reload()}
                        className="h-9 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-300"
                    >
                        Odśwież
                    </button>
                </div>

                {/* Filtry */}
                <div className="mt-3 grid gap-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                        <span className="text-zinc-400">🔎</span>
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                            placeholder="Szukaj po nazwie/opisie…"
                        />
                        {q ? (
                            <button
                                type="button"
                                onClick={() => setQ('')}
                                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800"
                                aria-label="Wyczyść"
                            >
                                ✕
                            </button>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Kategoria</label>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                            >
                                <option value="ALL">Wszystkie</option>
                                <option value="REGULAR">Regular</option>
                                <option value="AUTOMATRON">Automatron</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Dostępność</label>
                            <select
                                value={availability}
                                onChange={(e) => setAvailability(e.target.value as AvailabilityFilter)}
                                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                            >
                                <option value="ALL">Wszystkie</option>
                                <option value="INNATE">Tylko INNATE</option>
                                <option value="NON_INNATE">Tylko nie‑INNATE</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Na stronę</label>
                            <select
                                value={String(pageSize)}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                            >
                                {[10, 20, 50, 100].map((n) => (
                                    <option key={n} value={String(n)}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <SortBtn k="NAME" label="Nazwa" />
                        <SortBtn k="CATEGORY" label="Kategoria" />
                        <SortBtn k="INNATE" label="INNATE" />
                        <SortBtn k="START_ALLOWED" label="Startowy" />
                    </div>
                </div>

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
                            className="h-9 rounded-xl border border-zinc-700 bg-zinc-950 px-3 disabled:opacity-40"
                        >
                            «
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className="h-9 rounded-xl border border-zinc-700 bg-zinc-950 px-3 disabled:opacity-40"
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="h-9 rounded-xl border border-zinc-700 bg-zinc-950 px-3 disabled:opacity-40"
                        >
                            ›
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage(totalPages)}
                            disabled={safePage === totalPages}
                            className="h-9 rounded-xl border border-zinc-700 bg-zinc-950 px-3 disabled:opacity-40"
                        >
                            »
                        </button>
                    </div>
                </div>

                {/* Lista */}
                <div className="mt-3 grid gap-2">
                    {pageItems.map((p) => (
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

                    {pageItems.length === 0 ? (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-500">Brak wyników dla filtrów.</div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
