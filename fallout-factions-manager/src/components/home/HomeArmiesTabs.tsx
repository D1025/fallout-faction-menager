'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Drawer } from 'antd';

type ArmyMeta = {
    id: string;
    name: string;
    tier: number;
    factionName: string;
    subfactionName: string | null;
    rating: number;
};

type SharedMeta = { id: string; perm: 'READ' | 'WRITE'; army: ArmyMeta };

type SortKey = 'UPDATED' | 'NAME_ASC' | 'NAME_DESC' | 'TIER_ASC' | 'TIER_DESC' | 'RATING_ASC' | 'RATING_DESC';

type SubfactionMode = 'ANY' | 'ONLY_WITH' | 'ONLY_NONE';

type UiState = {
    tab: 'MINE' | 'SHARED';
    q: string;
    sort: SortKey;
    tierFilter: 'ALL' | 1 | 2 | 3;
    factionFilter: 'ALL' | string;
    subfactionFilter: 'ALL' | string;
    subfactionMode: SubfactionMode;
    permFilter: 'ALL' | 'READ' | 'WRITE';
    filtersOpen?: boolean;
};

const LS_KEY = 'homeArmiesTabs:v1';

function norm(s: string): string {
    return s.trim().toLowerCase();
}

function matchArmy(a: ArmyMeta, q: string): boolean {
    if (!q) return true;
    const n = norm(q);
    return (
        norm(a.name).includes(n) ||
        norm(a.factionName).includes(n) ||
        norm(a.subfactionName ?? '').includes(n) ||
        String(a.tier).includes(n) ||
        String(a.rating).includes(n)
    );
}

function sortArmies(arr: ArmyMeta[], key: SortKey): ArmyMeta[] {
    const copy = [...arr];
    switch (key) {
        case 'NAME_ASC':
            return copy.sort((a, b) => a.name.localeCompare(b.name));
        case 'NAME_DESC':
            return copy.sort((a, b) => b.name.localeCompare(a.name));
        case 'TIER_ASC':
            return copy.sort((a, b) => a.tier - b.tier);
        case 'TIER_DESC':
            return copy.sort((a, b) => b.tier - a.tier);
        case 'RATING_ASC':
            return copy.sort((a, b) => a.rating - b.rating);
        case 'RATING_DESC':
            return copy.sort((a, b) => b.rating - a.rating);
        // UPDATED: kolejność taka jak przyszła z serwera (już orderBy updatedAt)
        case 'UPDATED':
        default:
            return copy;
    }
}

function DotsMenu({
    kind,
    armyId,
    onDeleted,
}: {
    kind: 'MINE' | 'SHARED';
    armyId: string;
    onDeleted?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (btnRef.current?.contains(t)) return;
            if (menuRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    async function del() {
        setOpen(false);
        if (kind !== 'MINE') {
            alert('Na razie można usuwać tylko własne armie.');
            return;
        }
        const ok = confirm('Na pewno usunąć tę armię? Tej operacji nie da się cofnąć.');
        if (!ok) return;

        const res = await fetch(`/api/armies/${armyId}`, { method: 'DELETE' });
        if (!res.ok) {
            const t = await res.text().catch(() => '');
            alert(t || 'Nie udało się usunąć armii');
            return;
        }
        onDeleted?.();
    }

    return (
        <div className="relative">
            <button
                ref={btnRef}
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
                className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 active:scale-95"
                aria-label="Opcje"
                title="Opcje"
            >
                ⋯
            </button>

            {open && (
                <div
                    ref={menuRef}
                    className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    <button
                        type="button"
                        disabled
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-500 disabled:opacity-60"
                        title="Wkrótce"
                    >
                        <span className="text-base">⤴</span> Udostępnij (wkrótce)
                    </button>
                    <div className="h-px bg-zinc-800" />
                    <button
                        type="button"
                        onClick={() => void del()}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-200 hover:bg-red-950/40"
                    >
                        <span className="text-base">🗑</span> Usuń
                    </button>
                </div>
            )}
        </div>
    );
}

function ArmyCard({
    a,
    right,
    kind,
    onDeleted,
}: {
    a: ArmyMeta;
    right?: React.ReactNode;
    kind: 'MINE' | 'SHARED';
    onDeleted?: () => void;
}) {
    return (
        <div className="vault-panel min-h-11 p-3">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="inline-flex shrink-0 items-center rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-200">T{a.tier}</span>
                        <span className="inline-flex shrink-0 items-center rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-200">Rating {a.rating}</span>
                    </div>
                    <div className="mt-1 truncate font-medium">{a.name}</div>
                    <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-400">
                        <span className="truncate">{a.factionName}</span>
                        {a.subfactionName && <span className="truncate">• {a.subfactionName}</span>}

                        <span className="mx-0.5 h-3 w-px bg-zinc-700" aria-hidden="true" />
                    </div>
                </div>

                <div className="flex shrink-0 items-start gap-2">
                    {right}
                    <DotsMenu kind={kind} armyId={a.id} onDeleted={onDeleted} />
                </div>
            </div>
        </div>
    );
}

const safeParseInt = (v: string | null): 1 | 2 | 3 | null => {
    if (!v) return null;
    const n = Number(v);
    return n === 1 || n === 2 || n === 3 ? (n as 1 | 2 | 3) : null;
};

const readInitialState = (params: URLSearchParams): UiState => {
    const tab = (params.get('tab') === 'SHARED' ? 'SHARED' : 'MINE') as UiState['tab'];
    const q = params.get('q') ?? '';
    const sort = (params.get('sort') as SortKey) || 'UPDATED';

    const tier = params.get('tier');
    const tierN = safeParseInt(tier);
    const tierFilter: UiState['tierFilter'] = tier === 'ALL' || tier == null ? 'ALL' : tierN ?? 'ALL';

    const factionFilter = params.get('faction') ?? 'ALL';
    const subfactionFilter = params.get('subfaction') ?? 'ALL';
    const subfactionMode = (params.get('subMode') as SubfactionMode) || 'ANY';
    const permFilter = (params.get('perm') as UiState['permFilter']) || 'ALL';
    const filtersOpen = params.get('filters') === '1' ? true : undefined;

    return {
        tab,
        q,
        sort,
        tierFilter,
        factionFilter,
        subfactionFilter,
        subfactionMode: subfactionMode === 'ONLY_WITH' || subfactionMode === 'ONLY_NONE' ? subfactionMode : 'ANY',
        permFilter: permFilter === 'READ' || permFilter === 'WRITE' ? permFilter : 'ALL',
        filtersOpen,
    };
};

const writeStateToParams = (state: UiState): URLSearchParams => {
    const p = new URLSearchParams();
    p.set('tab', state.tab);
    if (state.q) p.set('q', state.q);
    if (state.sort !== 'UPDATED') p.set('sort', state.sort);
    if (state.tierFilter !== 'ALL') p.set('tier', String(state.tierFilter));
    if (state.factionFilter !== 'ALL') p.set('faction', state.factionFilter);
    if (state.subfactionFilter !== 'ALL') p.set('subfaction', state.subfactionFilter);
    if (state.subfactionMode !== 'ANY') p.set('subMode', state.subfactionMode);
    if (state.permFilter !== 'ALL') p.set('perm', state.permFilter);
    if (state.filtersOpen) p.set('filters', '1');
    return p;
};

const saveToLocalStorage = (state: UiState) => {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
        // ignore
    }
};

const loadFromLocalStorage = (): UiState | null => {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as UiState;
    } catch {
        return null;
    }
};

const uniqSorted = (values: string[]): string[] => {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
};

const applyFiltersToArmy = (a: ArmyMeta, state: UiState): boolean => {
    if (!matchArmy(a, state.q)) return false;
    if (state.tierFilter !== 'ALL' && a.tier !== state.tierFilter) return false;

    if (state.factionFilter !== 'ALL' && a.factionName !== state.factionFilter) return false;

    const hasSub = Boolean(a.subfactionName);
    if (state.subfactionMode === 'ONLY_WITH' && !hasSub) return false;
    if (state.subfactionMode === 'ONLY_NONE' && hasSub) return false;

    if (state.subfactionFilter !== 'ALL') {
        if ((a.subfactionName ?? '') !== state.subfactionFilter) return false;
    }

    return true;
};

function hasActiveFilters(state: UiState): boolean {
    return Boolean(
        state.q ||
            state.sort !== 'UPDATED' ||
            state.tierFilter !== 'ALL' ||
            state.factionFilter !== 'ALL' ||
            state.subfactionMode !== 'ANY' ||
            state.subfactionFilter !== 'ALL' ||
            state.permFilter !== 'ALL'
    );
}

export function HomeArmiesTabs({
    myArmies,
    shared,
    children,
}: {
    myArmies: ArmyMeta[];
    shared: SharedMeta[];
    children?: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const sp = useSearchParams();

    const initialFromUrl = useMemo(() => readInitialState(new URLSearchParams(sp.toString())), [sp]);

    const [state, setState] = useState<UiState>(() => {
        // URL ma priorytet; jeśli pusty (bez query) — próbujemy localStorage
        const fromLs = typeof window !== 'undefined' ? loadFromLocalStorage() : null;
        const hasAnyQuery = sp.toString().length > 0;
        return hasAnyQuery ? initialFromUrl : fromLs ?? initialFromUrl;
    });

    // sync: jeśli user wklei link z query — przejmujemy
    useEffect(() => {
        const hasAnyQuery = sp.toString().length > 0;
        if (!hasAnyQuery) return;
        setState(initialFromUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sp.toString()]);

    // persist -> URL + LS (debounce minimalny)
    useEffect(() => {
        saveToLocalStorage(state);
        const next = writeStateToParams(state);
        const href = next.toString() ? `${pathname}?${next.toString()}` : pathname;
        router.replace(href, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    const factions = useMemo(() => {
        const all = [...myArmies, ...shared.map((s) => s.army)].map((a) => a.factionName);
        return uniqSorted(all);
    }, [myArmies, shared]);

    const subfactions = useMemo(() => {
        const all = [...myArmies, ...shared.map((s) => s.army)].map((a) => a.subfactionName ?? '').filter(Boolean);
        return uniqSorted(all);
    }, [myArmies, shared]);

    const mineFiltered = useMemo(() => {
        const arr = myArmies.filter((a) => applyFiltersToArmy(a, state));
        return sortArmies(arr, state.sort);
    }, [myArmies, state]);

    const sharedFiltered = useMemo(() => {
        let arr = shared;

        if (state.permFilter !== 'ALL') {
            arr = arr.filter((s) => s.perm === state.permFilter);
        }

        arr = arr.filter((s) => applyFiltersToArmy(s.army, state));

        // sortujemy po polach armii
        const sortedArmies = sortArmies(arr.map((x) => x.army), state.sort);
        const order = new Map(sortedArmies.map((a, i) => [a.id, i] as const));
        return [...arr].sort((a, b) => (order.get(a.army.id) ?? 0) - (order.get(b.army.id) ?? 0));
    }, [shared, state]);

    const currentTotal = state.tab === 'MINE' ? myArmies.length : shared.length;
    const currentCount = state.tab === 'MINE' ? mineFiltered.length : sharedFiltered.length;

    // jeśli są aktywne filtry, a panel nieustawiony — otwórz
    useEffect(() => {
        if (state.filtersOpen === undefined && hasActiveFilters(state)) {
            setState((s) => ({ ...s, filtersOpen: true }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="pt-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Armie</div>
                <div>{children}</div>
            </div>

            {/* Tabs */}
            <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => setState((s) => ({ ...s, tab: 'MINE' }))}
                    className={
                        'h-11 rounded-xl border text-xs font-medium ' +
                        (state.tab === 'MINE'
                            ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                    }
                >
                    Moje armie ({myArmies.length})
                </button>
                <button
                    type="button"
                    onClick={() => setState((s) => ({ ...s, tab: 'SHARED' }))}
                    className={
                        'h-11 rounded-xl border text-xs font-medium ' +
                        (state.tab === 'SHARED'
                            ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                    }
                >
                    Udostępnione ({shared.length})
                </button>
            </div>

            {/* Search */}
            <div className="mt-3 grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <span className="text-zinc-400">🔎</span>
                    <input
                        value={state.q}
                        onChange={(e) => setState((s) => ({ ...s, q: e.target.value }))}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                        placeholder="Szukaj (nazwa, frakcja, subfrakcja, tier, rating)…"
                    />
                    {state.q && (
                        <button
                            type="button"
                            onClick={() => setState((s) => ({ ...s, q: '' }))}
                            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 active:scale-95"
                            aria-label="Wyczyść"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setState((s) => ({ ...s, filtersOpen: true }))}
                    className="flex min-h-11 items-center justify-between vault-panel px-3 py-2 text-left"
                    aria-expanded={Boolean(state.filtersOpen)}
                >
                    <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-200">Filtry i sortowanie</div>
                        <div className="mt-0.5 text-[11px] text-zinc-400">
                            Wyniki: <span className="font-semibold text-zinc-100">{currentCount}</span>/{currentTotal}
                            {hasActiveFilters(state) ? ' • aktywne filtry' : ' • brak filtrów'}
                        </div>
                    </div>
                    <div className="shrink-0 text-zinc-300">Ustaw</div>
                </button>

                <Drawer
                    title="Filtry i sortowanie"
                    placement="bottom"
                    height="80vh"
                    open={Boolean(state.filtersOpen)}
                    onClose={() => setState((s) => ({ ...s, filtersOpen: false }))}
                >
                    <div className="grid grid-cols-1 gap-2">
                        <div className="grid grid-cols-2 gap-2">
                            <select
                                value={String(state.tierFilter)}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setState((s) => ({ ...s, tierFilter: v === 'ALL' ? 'ALL' : (Number(v) as 1 | 2 | 3) }));
                                }}
                                className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                                aria-label="Filtr tier"
                            >
                                <option value="ALL">Wszystkie tiery</option>
                                <option value="1">Tier 1</option>
                                <option value="2">Tier 2</option>
                                <option value="3">Tier 3</option>
                            </select>

                            <select
                                value={state.sort}
                                onChange={(e) => setState((s) => ({ ...s, sort: e.target.value as SortKey }))}
                                className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                                aria-label="Sortowanie"
                            >
                                <option value="UPDATED">Sort: ostatnio aktualizowane</option>
                                <option value="NAME_ASC">Sort: nazwa A→Z</option>
                                <option value="NAME_DESC">Sort: nazwa Z→A</option>
                                <option value="TIER_ASC">Sort: tier rosnąco</option>
                                <option value="TIER_DESC">Sort: tier malejąco</option>
                                <option value="RATING_ASC">Sort: rating rosnąco</option>
                                <option value="RATING_DESC">Sort: rating malejąco</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <select
                                value={state.factionFilter}
                                onChange={(e) => setState((s) => ({ ...s, factionFilter: e.target.value }))}
                                className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                                aria-label="Filtr frakcja"
                            >
                                <option value="ALL">Wszystkie frakcje</option>
                                {factions.map((f) => (
                                    <option key={f} value={f}>
                                        {f}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={state.subfactionMode}
                                onChange={(e) => setState((s) => ({ ...s, subfactionMode: e.target.value as SubfactionMode }))}
                                className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                                aria-label="Filtr subfrakcja (tryb)"
                            >
                                <option value="ANY">Subfrakcja: dowolnie</option>
                                <option value="ONLY_WITH">Tylko z subfrakcją</option>
                                <option value="ONLY_NONE">Tylko bez subfrakcji</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <select
                                value={state.subfactionFilter}
                                onChange={(e) => setState((s) => ({ ...s, subfactionFilter: e.target.value }))}
                                disabled={state.subfactionMode === 'ONLY_NONE'}
                                className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 disabled:opacity-40"
                                aria-label="Filtr subfrakcja (konkretna)"
                            >
                                <option value="ALL">Wszystkie subfrakcje</option>
                                {subfactions.map((sf) => (
                                    <option key={sf} value={sf}>
                                        {sf}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={state.permFilter}
                                onChange={(e) =>
                                    setState((s) => ({ ...s, permFilter: e.target.value as UiState['permFilter'] }))
                                }
                                disabled={state.tab !== 'SHARED'}
                                className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 disabled:opacity-40"
                                aria-label="Filtr uprawnień (udostępnione)"
                            >
                                <option value="ALL">Perm: wszystkie</option>
                                <option value="READ">Perm: tylko odczyt</option>
                                <option value="WRITE">Perm: współpraca</option>
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setState({
                                    tab: 'MINE',
                                    q: '',
                                    sort: 'UPDATED',
                                    tierFilter: 'ALL',
                                    factionFilter: 'ALL',
                                    subfactionFilter: 'ALL',
                                    subfactionMode: 'ANY',
                                    permFilter: 'ALL',
                                    filtersOpen: false,
                                })
                            }
                            className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                        >
                            Wyczyść filtry
                        </button>
                    </div>
                </Drawer>
            </div>

            {/* Lists */}
            {state.tab === 'MINE' && (
                <section className="mt-3">
                    <div className="grid gap-2">
                        {mineFiltered.map((a) => (
                            <Link key={a.id} href={`/army/${a.id}`} className="block">
                                <ArmyCard
                                    a={a}
                                    kind="MINE"
                                    onDeleted={() => router.refresh()}
                                />
                            </Link>
                        ))}
                        {mineFiltered.length === 0 && (
                            <div className="vault-panel p-3 text-sm text-zinc-400">
                                Brak armii dla filtrów.
                            </div>
                        )}
                    </div>
                </section>
            )}

            {state.tab === 'SHARED' && (
                <section className="mt-3">
                    <div className="grid gap-2">
                        {sharedFiltered.map((s) => (
                            <Link key={s.id} href={`/army/${s.army.id}`} className="block">
                                <ArmyCard
                                    a={s.army}
                                    kind="SHARED"
                                    right={
                                        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px]">
                                            {s.perm === 'READ' ? 'tylko odczyt' : 'współpraca'}
                                        </span>
                                    }
                                />
                            </Link>
                        ))}
                        {sharedFiltered.length === 0 && (
                            <div className="vault-panel p-3 text-sm text-zinc-400">
                                Brak udostępnionych armii dla filtrów.
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
