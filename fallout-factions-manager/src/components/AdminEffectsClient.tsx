'use client';

import { ClearOutlined, FilterOutlined } from '@ant-design/icons';
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
            if (k === 'KIND') return a.kind.localeCompare(b.kind) * dir || a.name.localeCompare(b.name, 'pl');
            return a.name.localeCompare(b.name, 'pl') * dir;
        };
        return [...arr].sort(cmp);
    }, [list, q, kindFilter, sort]);

    const chips: ActiveFilterChip[] = [
        ...(q ? [{ key: 'q', label: `Szukaj: ${q}`, onRemove: () => setQ('') }] : []),
        ...(kindFilter !== 'ALL' ? [{ key: 'kind', label: `Rodzaj: ${kindFilter}`, onRemove: () => setKindFilter('ALL') }] : []),
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
            const msg = 'Nie udało się pobrać efektów. Odśwież widok i spróbuj ponownie.';
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

            {/* Lista */}
            <div className="grid gap-2">
                <div className="flex items-start justify-between gap-2 rounded-xl border border-zinc-800 p-3">
                    <div>
                        <div className="text-sm font-medium">Lista efektów</div>
                        <div className="mt-0.5 text-[11px] text-zinc-400">
                            Wyniki: <span className="font-semibold text-zinc-200">{filteredSorted.length}</span>
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

                <FilterBar
                    showTrigger={false}
                    open={filtersOpen}
                    onOpenChangeAction={setFiltersOpen}
                    search={q}
                    onSearchAction={setQ}
                    searchPlaceholder="Szukaj efektu…"
                    controls={
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <select
                                value={kindFilter}
                                onChange={(e) => setKindFilter(e.target.value as 'ALL' | EffectKind)}
                                className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                            >
                                <option value="ALL">Rodzaj: wszystkie</option>
                                <option value="WEAPON">Rodzaj: WEAPON</option>
                                <option value="CRITICAL">Rodzaj: CRITICAL</option>
                            </select>
                            <SortSelect
                                value={sort}
                                onChange={(v) => setSort(v as typeof sort)}
                                options={[
                                    { value: 'NAME:ASC', label: 'Sort: nazwa A→Z' },
                                    { value: 'NAME:DESC', label: 'Sort: nazwa Z→A' },
                                    { value: 'KIND:ASC', label: 'Sort: rodzaj A→Z' },
                                    { value: 'KIND:DESC', label: 'Sort: rodzaj Z→A' },
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
                    <EmptyState title="Brak efektów" description="Dodaj pierwszy efekt albo wyczyść filtry." />
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
                                Edytuj
                            </button>
                            <button className="text-xs text-red-300" onClick={() => void del(e.id)}>
                                Usuń
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
