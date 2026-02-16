'use client';

import Link from 'next/link';
import { confirmAction, notifyApiError, notifySuccess, notifyWarning } from '@/lib/ui/notify';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CopyOutlined, DeleteOutlined, EllipsisOutlined, LinkOutlined, QrcodeOutlined, ReloadOutlined, ShareAltOutlined, StopOutlined } from '@ant-design/icons';
import { FilterBar, SortSelect, type ActiveFilterChip } from '@/components/ui/filters';
import { EmptyState } from '@/components/ui/antd/ScreenStates';
import { Portal } from '@/components/ui/Portal';

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
};

const LS_KEY = 'homeArmiesTabs:v1';

type PublicSharePayload = {
    enabled: boolean;
    token: string | null;
    path: string | null;
};

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
        // UPDATED: preserve order returned by server (already sorted by updatedAt)
        case 'UPDATED':
        default:
            return copy;
    }
}

function normalizeSharePayload(raw: unknown): PublicSharePayload {
    if (!raw || typeof raw !== 'object') {
        return { enabled: false, token: null, path: null };
    }
    const data = raw as Record<string, unknown>;
    return {
        enabled: Boolean(data.enabled),
        token: typeof data.token === 'string' ? data.token : null,
        path: typeof data.path === 'string' ? data.path : null,
    };
}

function ShareArmyModal({
    armyId,
    open,
    onClose,
}: {
    armyId: string;
    open: boolean;
    onClose: () => void;
}) {
    const [origin, setOrigin] = useState('');
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [share, setShare] = useState<PublicSharePayload>({ enabled: false, token: null, path: null });

    useEffect(() => {
        if (!open) return;
        setOrigin(window.location.origin);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        setErrorText(null);
        const run = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/armies/${armyId}/public-share`, { cache: 'no-store' });
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    throw new Error(text || 'Failed to load share settings.');
                }
                const data = normalizeSharePayload(await res.json().catch(() => null));
                setShare(data);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load share settings.';
                setErrorText(message);
            } finally {
                setLoading(false);
            }
        };
        void run();
    }, [armyId, open]);

    async function enableOrRegenerate(action: 'ENABLE' | 'REGENERATE') {
        setBusy(true);
        setErrorText(null);
        try {
            const res = await fetch(`/api/armies/${armyId}/public-share`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || 'Failed to update share settings.');
            }
            const data = normalizeSharePayload(await res.json().catch(() => null));
            setShare(data);
            notifySuccess(action === 'ENABLE' ? 'Public link enabled.' : 'Public link regenerated.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update share settings.';
            setErrorText(message);
            notifyApiError(message, 'Failed to update share settings.');
        } finally {
            setBusy(false);
        }
    }

    async function disableSharing() {
        setBusy(true);
        setErrorText(null);
        try {
            const res = await fetch(`/api/armies/${armyId}/public-share`, { method: 'DELETE' });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || 'Failed to disable share link.');
            }
            const data = normalizeSharePayload(await res.json().catch(() => null));
            setShare(data);
            notifySuccess('Public link disabled.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to disable share link.';
            setErrorText(message);
            notifyApiError(message, 'Failed to disable share link.');
        } finally {
            setBusy(false);
        }
    }

    const shareUrl = share.enabled && share.path && origin ? `${origin}${share.path}` : '';
    const qrUrl = shareUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(shareUrl)}`
        : '';

    async function copyLink() {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            notifySuccess('Link copied.');
        } catch {
            notifyWarning('Could not copy automatically. Copy the link manually.');
        }
    }

    if (!open) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[1000] overflow-x-hidden"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
            >
                <button
                    aria-label="Close"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onClose();
                    }}
                    className="absolute inset-0 bg-black/70"
                />
                <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[560px] rounded-t-3xl border border-zinc-800 bg-zinc-950 shadow-[0_-10px_40px_rgba(0,0,0,.55)]">
                    <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                        <div>
                            <div className="text-sm font-semibold text-zinc-100">Share Army</div>
                            <div className="text-[11px] text-zinc-500">Public read-only link</div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onClose();
                            }}
                            className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
                        >
                            Close
                        </button>
                    </div>

                    <div className="vault-scrollbar max-h-[76vh] overflow-y-auto px-4 py-3">
                        {loading ? (
                            <div className="text-sm text-zinc-400">Loading share settings...</div>
                        ) : (
                            <>
                                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-xs text-zinc-300">
                                    Anyone with this link can view the army in read-only mode without logging in.
                                </div>

                                {errorText ? (
                                    <div className="mt-2 rounded-xl border border-red-900/80 bg-red-950/30 p-2 text-xs text-red-200">
                                        {errorText}
                                    </div>
                                ) : null}

                                {!share.enabled && (
                                    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                                        <div className="text-xs text-zinc-400">Sharing is currently disabled.</div>
                                        <button
                                            type="button"
                                            onClick={() => void enableOrRegenerate('ENABLE')}
                                            disabled={busy}
                                            className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-500/70 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 disabled:opacity-50"
                                        >
                                            <LinkOutlined /> Enable public link
                                        </button>
                                    </div>
                                )}

                                {share.enabled && (
                                    <div className="mt-3 space-y-3">
                                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                                            <label className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                                                Share Link
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    readOnly
                                                    value={shareUrl || share.path || ''}
                                                    className="vault-input h-10 flex-1 px-3 text-xs"
                                                    aria-label="Share link"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => void copyLink()}
                                                    disabled={busy || !shareUrl}
                                                    className="inline-flex h-10 items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 disabled:opacity-50"
                                                >
                                                    <CopyOutlined /> Copy
                                                </button>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                                            <div className="mb-2 inline-flex items-center gap-2 text-xs text-zinc-300">
                                                <QrcodeOutlined className="text-zinc-200" />
                                                QR Code
                                            </div>
                                            {qrUrl ? (
                                                <div className="flex justify-center rounded-xl border border-zinc-800 bg-white p-2">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={qrUrl} alt="QR code for shared army link" className="h-56 w-56" />
                                                </div>
                                            ) : (
                                                <div className="text-xs text-zinc-500">Preparing QR code...</div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() => void enableOrRegenerate('REGENERATE')}
                                                disabled={busy}
                                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 disabled:opacity-50"
                                            >
                                                <ReloadOutlined /> Regenerate link
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void disableSharing()}
                                                disabled={busy}
                                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-700/70 bg-red-950/30 px-3 text-xs text-red-200 disabled:opacity-50"
                                            >
                                                <StopOutlined /> Disable sharing
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Portal>
    );
}

function DotsMenu({
    kind,
    armyId,
    shareId,
    onDeleted,
}: {
    kind: 'MINE' | 'SHARED';
    armyId: string;
    shareId?: string;
    onDeleted?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
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
            notifyWarning('For now, you can only delete your own armies.');
            return;
        }
        confirmAction({
            title: 'Delete this army? This action cannot be undone.',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onOk: async () => {
                const res = await fetch(`/api/armies/${armyId}`, { method: 'DELETE' });
                if (!res.ok) {
                    const t = await res.text().catch(() => '');
                    notifyApiError(t || 'Failed to delete army');
                    throw new Error('delete failed');
                }
                onDeleted?.();
            },
        });
    }

    async function forget() {
        setOpen(false);
        if (kind !== 'SHARED' || !shareId) {
            notifyWarning('No shared link found to forget.');
            return;
        }
        confirmAction({
            title: 'Forget this shared army?',
            content: 'This removes the army from your shared list only.',
            okText: 'Forget',
            cancelText: 'Cancel',
            danger: true,
            onOk: async () => {
                const res = await fetch(`/api/army-shares/${shareId}`, { method: 'DELETE' });
                if (!res.ok) {
                    const t = await res.text().catch(() => '');
                    notifyApiError(t || 'Failed to forget shared army.');
                    throw new Error('forget failed');
                }
                notifySuccess('Shared army removed from your list.');
                onDeleted?.();
            },
        });
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
                className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 active:scale-95"
                aria-label="Options"
                title="Options"
            >
                <EllipsisOutlined className="text-zinc-200" />
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
                    {kind === 'MINE' ? (
                        <>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpen(false);
                                    setShareOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900"
                            >
                                <ShareAltOutlined className="text-zinc-300" /> Share read-only
                            </button>
                            <div className="h-px bg-zinc-800" />
                            <button
                                type="button"
                                onClick={() => void del()}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-200 hover:bg-red-950/40"
                            >
                                <DeleteOutlined className="text-red-300" /> Delete
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void forget()}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-200 hover:bg-red-950/40"
                        >
                            <DeleteOutlined className="text-red-300" /> Forget
                        </button>
                    )}
                </div>
            )}
            <ShareArmyModal
                armyId={armyId}
                open={shareOpen}
                onClose={() => setShareOpen(false)}
            />
        </div>
    );
}

function ArmyCard({
    a,
    right,
    kind,
    shareId,
    onDeleted,
}: {
    a: ArmyMeta;
    right?: React.ReactNode;
    kind: 'MINE' | 'SHARED';
    shareId?: string;
    onDeleted?: () => void;
}) {
    return (
        <div className="vault-panel p-3">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="truncate font-medium">{a.name}</div>
                    <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-400">
                        <span className="truncate">{a.factionName}</span>
                        {a.subfactionName && <span className="truncate">| {a.subfactionName}</span>}

                        <span className="mx-0.5 h-3 w-px bg-zinc-700" aria-hidden="true" />

                        <span className="inline-flex shrink-0 items-center rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-200">
                            T{a.tier}
                        </span>
                        <span className="inline-flex shrink-0 items-center rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-200">
                            Rating {a.rating}
                        </span>
                    </div>
                </div>

                <div className="flex shrink-0 items-start gap-2">
                    {right}
                    <DotsMenu kind={kind} armyId={a.id} shareId={shareId} onDeleted={onDeleted} />
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

    return {
        tab,
        q,
        sort,
        tierFilter,
        factionFilter,
        subfactionFilter,
        subfactionMode: subfactionMode === 'ONLY_WITH' || subfactionMode === 'ONLY_NONE' ? subfactionMode : 'ANY',
        permFilter: permFilter === 'READ' || permFilter === 'WRITE' ? permFilter : 'ALL',
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
    filtersOpen,
    onFiltersOpenChangeAction,
    onFiltersActiveChangeAction,
    onClearFiltersAction,
    clearFromHeaderTick,
    onClearFromHeaderAction,
}: {
    myArmies: ArmyMeta[];
    shared: SharedMeta[];
    children?: React.ReactNode;
    filtersOpen?: boolean;
    onFiltersOpenChangeAction?: (next: boolean) => void;
    onFiltersActiveChangeAction?: (active: boolean) => void;
    onClearFiltersAction?: () => void;
    clearFromHeaderTick?: number;
    onClearFromHeaderAction?: () => void;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const sp = useSearchParams();

    const initialFromUrl = useMemo(() => readInitialState(new URLSearchParams(sp.toString())), [sp]);

    // IMPORTANT: initial state must be deterministic for SSR + first client render.
    // Do not read localStorage in the initializer to avoid hydration mismatch.
    const [state, setState] = useState<UiState>(() => {
        const hasAnyQuery = sp.toString().length > 0;
        return hasAnyQuery ? initialFromUrl : initialFromUrl;
    });

    const [hydrated, setHydrated] = useState(false);

    // After mount: if URL query is empty, we can load preferences from localStorage.
    useEffect(() => {
        setHydrated(true);
        const hasAnyQuery = sp.toString().length > 0;
        if (hasAnyQuery) return;
        const fromLs = loadFromLocalStorage();
        if (fromLs) setState(fromLs);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync: if user opens a URL with query params, that state becomes source of truth.
    useEffect(() => {
        const hasAnyQuery = sp.toString().length > 0;
        if (!hasAnyQuery) return;
        setState(initialFromUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sp.toString()]);

    // persist -> URL + LS (debounce minimalny)
    useEffect(() => {
        // Before hydration, do not persist anything (to avoid overwriting localStorage). SSR will not enter here.
        if (!hydrated) return;
        saveToLocalStorage(state);
        const next = writeStateToParams(state);
        const href = next.toString() ? `${pathname}?${next.toString()}` : pathname;
        router.replace(href, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, hydrated]);

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

    const resetFilters = () => {
        setState((s) => ({
            ...s,
            q: '',
            sort: 'UPDATED',
            tierFilter: 'ALL',
            factionFilter: 'ALL',
            subfactionFilter: 'ALL',
            subfactionMode: 'ANY',
            permFilter: 'ALL',
        }));
        onClearFiltersAction?.();
    };

    const chips: ActiveFilterChip[] = [
        ...(state.q ? [{ key: 'q', label: `Search: ${state.q}`, onRemove: () => setState((s) => ({ ...s, q: '' })) }] : []),
        ...(state.tierFilter !== 'ALL'
            ? [{ key: 'tier', label: `Tier ${state.tierFilter}`, onRemove: () => setState((s) => ({ ...s, tierFilter: 'ALL' })) }]
            : []),
        ...(state.factionFilter !== 'ALL'
            ? [{ key: 'faction', label: `Faction: ${state.factionFilter}`, onRemove: () => setState((s) => ({ ...s, factionFilter: 'ALL' })) }]
            : []),
        ...(state.subfactionMode !== 'ANY'
            ? [{ key: 'submode', label: `Subfaction: ${state.subfactionMode === 'ONLY_WITH' ? 'only with' : 'only without'}`, onRemove: () => setState((s) => ({ ...s, subfactionMode: 'ANY' })) }]
            : []),
        ...(state.subfactionFilter !== 'ALL'
            ? [{ key: 'subfaction', label: `Subfaction: ${state.subfactionFilter}`, onRemove: () => setState((s) => ({ ...s, subfactionFilter: 'ALL' })) }]
            : []),
        ...(state.permFilter !== 'ALL'
            ? [{ key: 'perm', label: `Perm: ${state.permFilter}`, onRemove: () => setState((s) => ({ ...s, permFilter: 'ALL' })) }]
            : []),
    ];

    const hasActive = hasActiveFilters(state);

    useEffect(() => {
        onFiltersActiveChangeAction?.(hasActive);
    }, [hasActive, onFiltersActiveChangeAction]);

    // Local drawer state fallback when it is not controlled from outside.
    const [internalFiltersOpen, setInternalFiltersOpen] = useState(false);
    const isControlled = filtersOpen != null;
    const drawerOpen = isControlled ? Boolean(filtersOpen) : internalFiltersOpen;
    const setDrawerOpen = (next: boolean) => {
        if (!isControlled) setInternalFiltersOpen(next);
        onFiltersOpenChangeAction?.(next);
    };

    useEffect(() => {
        if (clearFromHeaderTick == null) return;
        // Do not auto-clear on first render.
        if (clearFromHeaderTick === 0) return;
        resetFilters();
        onClearFromHeaderAction?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clearFromHeaderTick]);

    return (
        <div className="pt-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Armies</div>
                <div>{children}</div>
            </div>

            {/* Tabs */}
            <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => setState((s) => ({ ...s, tab: 'MINE' }))}
                    className={
                        'h-10 rounded-xl border text-xs font-medium ' +
                        (state.tab === 'MINE'
                            ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                    }
                >
                    My armies ({myArmies.length})
                </button>
                <button
                    type="button"
                    onClick={() => setState((s) => ({ ...s, tab: 'SHARED' }))}
                    className={
                        'h-10 rounded-xl border text-xs font-medium ' +
                        (state.tab === 'SHARED'
                            ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                    }
                >
                    Shared ({shared.length})
                </button>
            </div>

            <div className="mt-3">
                <div className="mb-2 text-[11px] text-zinc-400">
                    Results: <span className="font-semibold text-zinc-100">{currentCount}</span>/{currentTotal}
                    {hasActive ? ' | active filters' : ' | no filters'}
                </div>
            </div>

            {/* Render filter drawer outside layout to avoid leaving empty containers. */}
            <FilterBar
                showTrigger={false}
                open={drawerOpen}
                onOpenChangeAction={setDrawerOpen}
                search={state.q}
                onSearchAction={(q) => setState((s) => ({ ...s, q }))}
                searchPlaceholder="Search (name, faction, subfaction, tier, rating)..."
                moreFilters={
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="block min-w-0">
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Tier</div>
                                <select
                                    value={String(state.tierFilter)}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setState((s) => ({ ...s, tierFilter: v === 'ALL' ? 'ALL' : (Number(v) as 1 | 2 | 3) }));
                                    }}
                                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                                    aria-label="Tier filter"
                                >
                                    <option value="ALL">All tiers</option>
                                    <option value="1">Tier 1</option>
                                    <option value="2">Tier 2</option>
                                    <option value="3">Tier 3</option>
                                </select>
                            </label>
                            <SortSelect
                                value={state.sort}
                                onChange={(sort) => setState((s) => ({ ...s, sort: sort as SortKey }))}
                                label="Sort"
                                options={[
                                    { value: 'UPDATED', label: 'Sort: recently used' },
                                    { value: 'NAME_ASC', label: 'Sort: name A-Z' },
                                    { value: 'NAME_DESC', label: 'Sort: name Z-A' },
                                    { value: 'TIER_ASC', label: 'Sort: tier ascending' },
                                    { value: 'TIER_DESC', label: 'Sort: tier descending' },
                                    { value: 'RATING_ASC', label: 'Sort: rating ascending' },
                                    { value: 'RATING_DESC', label: 'Sort: rating descending' },
                                ]}
                            />
                        </div>

                        <select
                            value={state.factionFilter}
                            onChange={(e) => setState((s) => ({ ...s, factionFilter: e.target.value }))}
                            className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                            aria-label="Faction filter"
                        >
                            <option value="ALL">All factions</option>
                            {factions.map((f) => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>

                        <select
                            value={state.subfactionMode}
                            onChange={(e) => setState((s) => ({ ...s, subfactionMode: e.target.value as SubfactionMode }))}
                            className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                        >
                            <option value="ANY">Subfaction: any</option>
                            <option value="ONLY_WITH">Only with subfaction</option>
                            <option value="ONLY_NONE">Only without subfaction</option>
                        </select>

                        <select
                            value={state.subfactionFilter}
                            onChange={(e) => setState((s) => ({ ...s, subfactionFilter: e.target.value }))}
                            disabled={state.subfactionMode === 'ONLY_NONE'}
                            className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 disabled:opacity-40"
                        >
                            <option value="ALL">All subfactions</option>
                            {subfactions.map((sf) => (
                                <option key={sf} value={sf}>{sf}</option>
                            ))}
                        </select>

                        <select
                            value={state.permFilter}
                            onChange={(e) => setState((s) => ({ ...s, permFilter: e.target.value as UiState['permFilter'] }))}
                            disabled={state.tab !== 'SHARED'}
                            className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 disabled:opacity-40"
                        >
                            <option value="ALL">Perm: all</option>
                            <option value="READ">Perm: read-only</option>
                            <option value="WRITE">Perm: collaboration</option>
                        </select>
                    </>
                }
                activeChips={chips}
                onClearAllAction={resetFilters}
            />

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
                            <EmptyState title="No armies" description="No armies match selected filters." />
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
                                    shareId={s.id}
                                    onDeleted={() => router.refresh()}
                                    right={
                                        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px]">
                                            {s.perm === 'READ' ? 'read-only' : 'collaboration'}
                                        </span>
                                    }
                                />
                            </Link>
                        ))}
                        {sharedFiltered.length === 0 && (
                            <EmptyState title="No shared armies" description="Change filters or request access to an army." />
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
