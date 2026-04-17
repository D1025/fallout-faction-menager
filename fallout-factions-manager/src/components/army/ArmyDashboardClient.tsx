'use client';

import {
    AppstoreOutlined,
    CloseOutlined,
    DeploymentUnitOutlined,
    DownOutlined,
    EllipsisOutlined,
    InfoCircleOutlined,
    MedicineBoxOutlined,
    SearchOutlined,
    StarOutlined,
    ThunderboltOutlined,
    UpOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { FilterBar, QuickToggle, type ActiveFilterChip } from '@/components/ui/filters';
import { Portal } from '@/components/ui/Portal';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EffectTooltip, usePreloadEffects } from '@/components/effects/EffectTooltip';
import { RuleDescription } from '@/components/rules/RuleDescription';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';

type Kind = 'caps' | 'parts' | 'scout' | 'reach' | 'exp' | 'ploys';
type CoreKind = Exclude<Kind, 'ploys'>;
type UIFactionLimit = { tag: string; tier1: number | null; tier2: number | null; tier3: number | null };

/* ==== weapon types aligned with override logic ==== */
type EffectKind = 'WEAPON' | 'CRITICAL';
type UIEffect = {
    id: string;
    effectId?: string;
    name: string;
    kind: EffectKind;
    valueInt: number | null;
    valueText?: string | null;
    effectMode?: 'ADD' | 'REMOVE';
};
type UIProfile = {
    id: string;
    typeOverride: string | null;
    testOverride: string | null;
    effects: UIEffect[];
    parts?: number | null;
    rating?: number | null;
};

type UnitListItem = {
    id: string;
    templateName: string;
    roleTag: string | null;
    base: { hp: number } & Record<'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L', number>;
    bonus: Record<'HP' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L', number>;
    bonusPositive?: Record<'HP' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L', number>;
    bonusNegative?: Record<'HP' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L', number>;
    wounds: number;
    present: boolean;
    upgradesCount: number;
    perkNames: string[];
    startPerkNames?: string[];
    photoPath: string | null;
    rating: number;

    weapons: {
        name: string;
        selectedProfileIds: string[];
        baseType: string;
        baseTest: string;
        baseEffects: UIEffect[];
        profiles: UIProfile[];
    }[];

    isLeader?: boolean;
    temporaryLeader?: boolean;
};

type RoleFilter = 'ALL' | 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS';
type TabKey = 'OVERVIEW' | 'EDIT' | 'TASKS' | 'TURF';
type SpecialStatKey = 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L';
type WeaponTestHint = { weaponIndex: 0 | 1; stat: SpecialStatKey };

/* ====== Goals API ====== */
type Goal = {
    id: string;
    tier: 1 | 2 | 3;
    description: string;
    target: number;
    order: number;
    ticks: number;
};
type GoalsResponse = {
    armyId: string;
    currentTier: number;
    set: { id: string; name: string } | null;
    goals: Goal[];
};

type UIChem = {
    id: string;
    name: string;
    rarity: 'COMMON' | 'UNCOMMON';
    costCaps: number;
    effect: string;
    sortOrder: number;
    quantity: number;
};

type UITurfDefinition = {
    id: string;
    name: string;
    description: string;
    sortOrder: number;
};

type UILegacyFacility = { id: string; name: string };

type HomeTurfResponse = {
    hazardId: string | null;
    hazardLegacy: string;
    hazards: UITurfDefinition[];
    facilities: UITurfDefinition[];
    selectedFacilityIds: string[];
    legacyFacilities: UILegacyFacility[];
};

type PopPos = { top: number; left: number; maxWidth: number };

const SPECIAL_STAT_KEYS: readonly SpecialStatKey[] = ['S', 'P', 'E', 'C', 'I', 'A', 'L'] as const;

const WEAPON_TEST_ACCENTS = [
    {
        textClass: 'text-sky-100',
        textBgClass: 'bg-sky-500/18',
        cellClass: 'bg-sky-500/12',
    },
    {
        textClass: 'text-amber-100',
        textBgClass: 'bg-amber-500/18',
        cellClass: 'bg-amber-500/12',
    },
] as const;

function parseTestSpecialStat(test: string | null | undefined): SpecialStatKey | null {
    const normalized = (test ?? '').toUpperCase();
    for (const ch of normalized) {
        if ((SPECIAL_STAT_KEYS as readonly string[]).includes(ch)) return ch as SpecialStatKey;
    }
    return null;
}

function getWeaponAccent(index: number) {
    return WEAPON_TEST_ACCENTS[index] ?? WEAPON_TEST_ACCENTS[0];
}

function StickyInfoTooltip({ title, description }: { title: string; description: string }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<PopPos | null>(null);
    const rootRef = useRef<HTMLSpanElement | null>(null);

    function computePos() {
        const el = rootRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const margin = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const maxWidth = Math.min(360, Math.max(240, Math.floor(vw * 0.88)));
        let left = r.left + r.width / 2 - maxWidth / 2;
        left = Math.max(margin, Math.min(left, vw - maxWidth - margin));
        const desiredHeight = 150;
        const belowTop = r.bottom + 8;
        const aboveTop = r.top - desiredHeight - 8;
        const hasRoomBelow = belowTop + desiredHeight + margin <= vh;
        const top = hasRoomBelow ? belowTop : Math.max(margin, aboveTop);
        setPos({ top, left, maxWidth });
    }

    useEffect(() => {
        if (!open) return;
        computePos();
        const onScroll = () => computePos();
        const onResize = () => computePos();
        const onDown = (e: MouseEvent | TouchEvent) => {
            const t = e.target as Node;
            if (rootRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        window.addEventListener('mousedown', onDown);
        window.addEventListener('touchstart', onDown, { passive: true });
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('touchstart', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <>
            <span
                ref={rootRef}
                className="inline-flex h-7 w-7 shrink-0 cursor-help items-center justify-center rounded-full bg-zinc-900 text-[11px] text-zinc-400"
                role="button"
                tabIndex={0}
                aria-label={`Description: ${title}`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpen((v) => !v);
                    }
                }}
            >
                <InfoCircleOutlined />
            </span>
            {open && pos ? (
                <Portal>
                    <div
                        style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.maxWidth, zIndex: 1000 }}
                        className="rounded-2xl bg-zinc-950 p-3 text-xs text-zinc-200 shadow-xl"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <div className="font-semibold">{title}</div>
                        <div className="mt-1 whitespace-pre-wrap text-zinc-300">{description}</div>
                    </div>
                </Portal>
            ) : null}
        </>
    );
}

export type ArmyDashboardActions = {
    openFilters: () => void;
    clearFilters: () => void;
};

export function ArmyDashboardClient({
    armyId,
    armyName,
    tier,
    factionId,
    factionName,
    factionLimits,
    resources,
    units,
    rating,
    subfactionId,
    // zamiast refa
    onActionsReadyAction,
    onFiltersActiveChangeAction,
}: {
    armyId: string;
    armyName: string;
    tier: number;
    factionId: string;
    factionName: string;
    factionLimits: UIFactionLimit[];
    resources: Record<Kind, number>;
    units: UnitListItem[];
    rating: number;
    subfactionId?: string | null;
    onActionsReadyAction?: (actions: ArmyDashboardActions) => void;
    onFiltersActiveChangeAction?: (active: boolean) => void;
}) {
    return (
        <ArmyDashboardClientInner
            armyId={armyId}
            armyName={armyName}
            tier={tier}
            factionId={factionId}
            factionName={factionName}
            factionLimits={factionLimits}
            resources={resources}
            units={units}
            rating={rating}
            subfactionId={subfactionId}
            onActionsReadyAction={onActionsReadyAction}
            onFiltersActiveChangeAction={onFiltersActiveChangeAction}
        />
    );
}

function ArmyDashboardClientInner({
    armyId,
    armyName,
    tier,
    factionId,
    factionName,
    factionLimits,
    resources,
    units,
    rating,
    subfactionId,
    onActionsReadyAction,
    onFiltersActiveChangeAction,
}: {
    armyId: string;
    armyName: string;
    tier: number;
    factionId: string;
    factionName: string;
    factionLimits: UIFactionLimit[];
    resources: Record<Kind, number>;
    units: UnitListItem[];
    rating: number;
    subfactionId?: string | null;
    onActionsReadyAction?: (actions: ArmyDashboardActions) => void;
    onFiltersActiveChangeAction?: (active: boolean) => void;
}) {
    const router = useRouter();
    const [totals, setTotals] = useState(resources);
    const [orderedUnits, setOrderedUnits] = useState<UnitListItem[]>(units);
    const [presentById, setPresentById] = useState<Record<string, boolean>>({});
    const [reordering, setReordering] = useState(false);
    const [busy, setBusy] = useState<Kind | null>(null);
    const [adding, setAdding] = useState(false);
    const [filter, setFilter] = useState<RoleFilter>('ALL');
    const [hideInactive, setHideInactive] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>('OVERVIEW');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [chems, setChems] = useState<UIChem[]>([]);
    const [loadingChems, setLoadingChems] = useState(false);
    const [updatingChemId, setUpdatingChemId] = useState<string | null>(null);
    const [chemsLoaded, setChemsLoaded] = useState(false);
    const [chemQuery, setChemQuery] = useState('');
    const [showOwnedChemsOnly, setShowOwnedChemsOnly] = useState(false);
    const [resourceEditorKind, setResourceEditorKind] = useState<CoreKind | null>(null);
    const [resourceDraft, setResourceDraft] = useState<string>('');

    useEffect(() => setTotals(resources), [resources]);
    useEffect(() => setOrderedUnits(units), [units]);
    useEffect(() => {
        setPresentById((prev) => {
            const next: Record<string, boolean> = {};
            for (const u of units) next[u.id] = prev[u.id] ?? u.present;
            return next;
        });
    }, [units]);

    async function setValue(kind: Kind, value: number) {
        const v = Math.max(0, Math.floor(value));
        setBusy(kind);
        try {
            const res = await fetch(`/api/armies/${armyId}/resources`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [kind]: v }),
            });
            if (!res.ok) throw new Error(await res.text());
            setTotals((t) => ({ ...t, [kind]: v }));
        } catch {
            notifyApiError('Failed to save resources');
        } finally {
            setBusy(null);
        }
    }

    function openResourceEditor(kind: CoreKind) {
        setResourceEditorKind(kind);
        setResourceDraft(String(Math.max(0, totals[kind] ?? 0)));
    }

    function closeResourceEditor() {
        setResourceEditorKind(null);
        setResourceDraft('');
    }

    function shiftResourceDraft(delta: number) {
        if (!resourceEditorKind) return;
        setResourceDraft((prev) => String(Math.max(0, n(prev, totals[resourceEditorKind] ?? 0) + delta)));
    }

    async function saveResourceEditor() {
        if (!resourceEditorKind) return;
        await setValue(resourceEditorKind, n(resourceDraft, totals[resourceEditorKind]));
        closeResourceEditor();
    }

    async function loadChems(force = false) {
        if (loadingChems) return;
        if (!force && chemsLoaded) return;
        setLoadingChems(true);
        try {
            const res = await fetch(`/api/armies/${armyId}/chems`, { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const data = (await res.json()) as { chems?: UIChem[] };
            setChems(
                (data.chems ?? []).map((c) => ({
                    ...c,
                    quantity: Math.max(0, Math.min(3, Math.floor(c.quantity ?? 0))),
                })),
            );
            setChemsLoaded(true);
        } catch {
            notifyApiError('Failed to load chem list');
        } finally {
            setLoadingChems(false);
        }
    }

    async function setChemQuantity(chemId: string, nextQuantity: number) {
        const next = Math.max(0, Math.min(3, Math.floor(nextQuantity)));
        const prev = chems.find((c) => c.id === chemId)?.quantity ?? 0;
        if (prev === next) return;

        setUpdatingChemId(chemId);
        setChems((arr) => arr.map((c) => (c.id === chemId ? { ...c, quantity: next } : c)));
        try {
            const res = await fetch(`/api/armies/${armyId}/chems`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chemId, quantity: next }),
            });
            if (!res.ok) throw new Error();
        } catch {
            setChems((arr) => arr.map((c) => (c.id === chemId ? { ...c, quantity: prev } : c)));
            notifyApiError('Failed to save chem quantity');
        } finally {
            setUpdatingChemId(null);
        }
    }

    async function deleteUnit(unitId: string) {
        confirmAction({
            title: 'Delete this unit from the army?',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onOk: async () => {
                setDeletingId(unitId);
                try {
                    const res = await fetch(`/api/armies/${armyId}/units/${unitId}`, { method: 'DELETE' });
                    if (!res.ok) {
                        const txt = await res.text().catch(() => '');
                        throw new Error(txt || 'Request failed');
                    }
                    router.refresh();
                } catch {
                    notifyApiError('Failed to delete unit');
                    throw new Error('delete failed');
                } finally {
                    setDeletingId(null);
                }
            },
        });
    }

    async function moveUnit(unitId: string, direction: 'up' | 'down') {
        if (reordering) return;
        const from = orderedUnits.findIndex((u) => u.id === unitId);
        if (from < 0) return;
        const to = direction === 'up' ? from - 1 : from + 1;
        if (to < 0 || to >= orderedUnits.length) return;

        const prev = orderedUnits;
        const next = [...orderedUnits];
        [next[from], next[to]] = [next[to], next[from]];
        setOrderedUnits(next);
        setReordering(true);

        try {
            const res = await fetch(`/api/armies/${armyId}/units/reorder`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unitIds: next.map((u) => u.id) }),
            });
            if (!res.ok) throw new Error();
        } catch {
            setOrderedUnits(prev);
            notifyApiError('Failed to save unit order.');
        } finally {
            setReordering(false);
        }
    }

    function onUnitPresenceChange(unitId: string, present: boolean) {
        setPresentById((prev) => ({ ...prev, [unitId]: present }));
    }

    function onUnitWoundsChange(unitId: string, wounds: number) {
        setOrderedUnits((prev) =>
            prev.map((unit) => (unit.id === unitId ? { ...unit, wounds } : unit)),
        );
    }

    function n(v: string, def = 0) {
        const x = Number(v);
        return Number.isFinite(x) ? x : def;
    }

    const displayRating = useMemo(
        () => {
            if (orderedUnits.length === 0) return rating;
            return orderedUnits.reduce((sum, u) => {
                const present = presentById[u.id] ?? u.present;
                return sum + (present ? u.rating : 0);
            }, 0);
        },
        [orderedUnits, presentById, rating],
    );

    const unitIndexById = useMemo(() => {
        const map = new Map<string, number>();
        orderedUnits.forEach((u, idx) => map.set(u.id, idx));
        return map;
    }, [orderedUnits]);

    const groups = useMemo(() => {
        const champion: UnitListItem[] = [];
        const grunt: UnitListItem[] = [];
        const companion: UnitListItem[] = [];
        const legends: UnitListItem[] = [];
        for (const u of orderedUnits) {
            const tag = (u.roleTag ?? 'GRUNT').toUpperCase();
            if (tag === 'LEGENDS') legends.push(u);
            else if (tag === 'CHAMPION') champion.push(u);
            else if (tag === 'COMPANION') companion.push(u);
            else grunt.push(u);
        }
        return { champion, grunt, companion, legends };
    }, [orderedUnits]);

    const filtered = useMemo(() => {
        const key =
            filter === 'CHAMPION'
                ? 'champion'
                : filter === 'GRUNT'
                    ? 'grunt'
                    : filter === 'COMPANION'
                        ? 'companion'
                        : filter === 'LEGENDS'
                            ? 'legends'
                            : null;

        const base = key ? groups[key] : orderedUnits;

        return base.filter((u) => {
            if (!hideInactive) return true;
            const present = presentById[u.id] ?? u.present;
            if (!present) return false;
            const maxHp = u.base.hp + u.bonus.HP;
            const dead = (u.wounds ?? 0) >= maxHp;
            if (dead) return false;
            return true;
        });
    }, [filter, orderedUnits, groups, hideInactive, presentById]);

    function FactionLimitsTable({ limits, activeTier }: { limits: UIFactionLimit[]; activeTier: number }) {
        const thCls = (t: 1 | 2 | 3) =>
            'px-1.5 py-1 text-center ' +
            (activeTier === t ? 'text-emerald-200' : 'text-zinc-500');
        const tdCls = (t: 1 | 2 | 3) =>
            'px-1.5 py-1 text-center tabular-nums ' +
            (activeTier === t ? 'bg-emerald-500/12 font-semibold text-emerald-200' : 'text-zinc-300');

        return (
            <div className="mt-2">
                <table className="w-full table-fixed text-[10px] leading-tight">
                    <thead className="bg-zinc-950/50">
                        <tr className="uppercase tracking-wide">
                            <th className="w-[46%] px-1.5 py-1 text-left text-zinc-500">Limit</th>
                            <th className={thCls(1)}>T1</th>
                            <th className={thCls(2)}>T2</th>
                            <th className={thCls(3)}>T3</th>
                        </tr>
                    </thead>
                    <tbody>
                        {limits.map((l, idx) => (
                            <tr key={`${l.tag}_${idx}`}>
                                <td className="px-1.5 py-1.5 break-words text-zinc-200">{l.tag}</td>
                                <td className={tdCls(1)}>{l.tier1 ?? '-'}</td>
                                <td className={tdCls(2)}>{l.tier2 ?? '-'}</td>
                                <td className={tdCls(3)}>{l.tier3 ?? '-'}</td>
                            </tr>
                        ))}
                        {limits.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-1.5 py-2 text-center text-zinc-500">
                                    No limits.
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>
        );
    }

    /* ---------- SPECIAL (kompakt) ---------- */
    function SpecialCompact({
                                base,
                                bonus,
                                bonusPositive,
                                bonusNegative,
                                hints = [],
                            }: {
        base: UnitListItem['base'];
        bonus: UnitListItem['bonus'];
        bonusPositive?: UnitListItem['bonusPositive'];
        bonusNegative?: UnitListItem['bonusNegative'];
        hints?: WeaponTestHint[];
    }) {
        const HEAD = ['S', 'P', 'E', 'C', 'I', 'A', 'L'] as const;

        return (
            <div className="overflow-hidden bg-zinc-950/60">
                <div className="grid grid-cols-7 bg-teal-700/65 text-[13px] font-semibold tracking-wide text-teal-50">
                    {HEAD.map((h) => (
                        <div key={h} className="px-0.5 py-0.5 text-center">
                            {h}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 bg-zinc-950/95 text-[13px] text-zinc-100">
                    {HEAD.map((h) => {
                        const baseVal = base[h];
                        const finalVal = base[h] + bonus[h];
                        const delta = finalVal - baseVal;
                        const plus = bonusPositive?.[h] ?? Math.max(0, bonus[h]);
                        const minus = bonusNegative?.[h] ?? Math.max(0, -bonus[h]);
                        const hasW1 = hints.some((hint) => hint.weaponIndex === 0 && hint.stat === h);
                        const hasW2 = hints.some((hint) => hint.weaponIndex === 1 && hint.stat === h);
                        const accentClass = hasW1 && hasW2
                            ? 'bg-violet-500/12'
                            : hasW1
                                ? WEAPON_TEST_ACCENTS[0].cellClass
                                : hasW2
                                    ? WEAPON_TEST_ACCENTS[1].cellClass
                                    : '';
                        return (
                            <div key={h} className={'relative px-0.5 py-1 text-center tabular-nums leading-none ' + accentClass}>
                                <div className={delta !== 0 ? (delta > 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-red-300') : ''}>
                                    {finalVal}
                                </div>
                                {plus > 0 ? (
                                    <span className="absolute right-0.5 top-0.5 text-[10px] leading-none text-emerald-400">+{plus}</span>
                                ) : null}
                                {minus > 0 ? (
                                    <span className="absolute bottom-0.5 right-0.5 text-[10px] leading-none text-red-400">-{minus}</span>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    /* ---------- helper: X -> valueInt ---------- */
    function formatEffect(name: string, valueInt: number | null, valueText?: string | null): string {
        let out = name;
        if (valueInt != null) {
            const replaced = out.replace(/\(\s*X\s*\)/g, String(valueInt)).replace(/\bX\b/g, String(valueInt));
            out = replaced !== out ? replaced : `${out} (${valueInt})`;
        }
        if (valueText && valueText.trim()) {
            out += ` [${valueText.trim()}]`;
        }
        return out;
    }

    function EffectChip({ e }: { e: UIEffect }) {
        const label = formatEffect(e.name, e.valueInt, e.valueText);
        if (e.effectId) {
            return (
                <EffectTooltip
                    effectId={e.effectId}
                    label={label}
                    className="cursor-help underline decoration-dotted underline-offset-2"
                />
            );
        }
        return <span className="cursor-default">{label}</span>;
    }

    function EffectsInline({ effects, kind }: { effects: UIEffect[]; kind: UIEffect['kind'] }) {
        const items = effects.filter((x) => x.kind === kind);
        if (items.length === 0) return <span>-</span>;
        return (
            <span className="whitespace-normal break-words">
                {items.map((e, idx) => (
                    <span key={`${e.id}_${idx}`}>
                        <EffectChip e={e} />
                        {idx < items.length - 1 ? ', ' : ''}
                    </span>
                ))}
            </span>
        );
    }

    /* ---------- helper: compute final weapon fields ---------- */
    function computeWeaponDisplay(w: UnitListItem['weapons'][number]) {
        const rev = [...w.selectedProfileIds].reverse();
        const typeOverId = rev.find((id) => {
            const p = w.profiles.find((pp) => pp.id === id);
            return Boolean(p && p.typeOverride != null);
        });
        const testOverId = rev.find((id) => {
            const p = w.profiles.find((pp) => pp.id === id);
            return Boolean(p && p.testOverride != null);
        });

        const typeOver = typeOverId ? w.profiles.find((pp) => pp.id === typeOverId) ?? null : null;
        const testOver = testOverId ? w.profiles.find((pp) => pp.id === testOverId) ?? null : null;

        const type = typeOver?.typeOverride ?? w.baseType;
        const test = testOver?.testOverride ?? w.baseTest;

        const effectKey = (e: UIEffect) => (e.effectId ? `id:${e.effectId}` : `${e.kind}:${e.name}:${e.valueInt ?? ''}:${e.valueText ?? ''}`);
        const agg = new Map<string, UIEffect>();
        for (const e of w.baseEffects) {
            agg.set(effectKey(e), { ...e, effectMode: 'ADD' });
        }
        for (const pId of w.selectedProfileIds) {
            const p = w.profiles.find((pp) => pp.id === pId);
            if (!p) continue;
            for (const e of p.effects) {
                const key = effectKey(e);
                if ((e.effectMode ?? 'ADD') === 'REMOVE') {
                    agg.delete(key);
                } else {
                    agg.set(key, { ...e, effectMode: 'ADD' });
                }
            }
        }

        const allEffects = [...agg.values()];

        return { type, test, allEffects };
    }

    function splitTypeAndRange(raw: string | null | undefined): { type: string; range: string } {
        const text = (raw ?? '').trim();
        if (!text) return { type: '-', range: '-' };
        const rangeMatch = text.match(/\(([^)]*)\)/);
        const range = rangeMatch?.[1]?.trim() ?? '-';
        const type = text
            .replace(/\([^)]*\)/g, '')
            .replace(/\s*-\s*$/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        return { type: type || '-', range };
    }

    /* ---------- Wiersz units ---------- */
    function UnitRow({
                         u,
                         armyId: aId,
                         onDelete,
                         deleting,
                         onPresenceChange,
                         onWoundsChange,
                         canMoveUp,
                         canMoveDown,
                         onMoveUp,
                         onMoveDown,
                         reordering,
                     }: {
        u: UnitListItem;
        armyId: string;
        onDelete: () => void;
        deleting: boolean;
        onPresenceChange: (unitId: string, present: boolean) => void;
        onWoundsChange: (unitId: string, wounds: number) => void;
        canMoveUp: boolean;
        canMoveDown: boolean;
        onMoveUp: () => void;
        onMoveDown: () => void;
        reordering: boolean;
    }) {
        // preload effects for this unit (tooltips appear instantly)
        const effectIdsToPreload = useMemo(() => {
            const ids: string[] = [];
            for (const w of u.weapons) {
                for (const e of w.baseEffects) if (e.effectId) ids.push(e.effectId);
                for (const p of w.profiles) for (const e of p.effects) if (e.effectId) ids.push(e.effectId);
            }
            return ids;
        }, [u.weapons]);
        usePreloadEffects(effectIdsToPreload);

        const [wounds, setWounds] = useState(u.wounds);
        const [absent, setAbsent] = useState(!u.present);
        const [tmpLeader, setTmpLeader] = useState(Boolean(u.temporaryLeader));
        const [photoMissing, setPhotoMissing] = useState(false);
        const [menuOpen, setMenuOpen] = useState(false);
        const menuBtnRef = useRef<HTMLButtonElement | null>(null);
        const menuRef = useRef<HTMLDivElement | null>(null);
        const headerSpecialRef = useRef<HTMLDivElement | null>(null);
        const [headerSpecialSize, setHeaderSpecialSize] = useState(64);
        const profileSrc = `/api/units/${u.id}/photo/file`;

        async function savePresence(nextPresent: boolean) {
            const prevAbsent = absent;
            const prevPresent = !prevAbsent;
            setAbsent(!nextPresent);
            onPresenceChange(u.id, nextPresent);
            const res = await fetch(`/api/units/${u.id}/presence`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ present: nextPresent }),
            }).catch(() => null);

            if (!res || !res.ok) {
                setAbsent(prevAbsent);
                onPresenceChange(u.id, prevPresent);
                notifyApiError('Failed to save presence.');
                return;
            }

            router.refresh();
        }

        async function saveWounds(next: number) {
            const prev = wounds;
            setWounds(next);
            onWoundsChange(u.id, next);
            const res = await fetch(`/api/units/${u.id}/wounds`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wounds: next }),
            }).catch(() => null);

            if (!res || !res.ok) {
                setWounds(prev);
                onWoundsChange(u.id, prev);
                notifyApiError('Failed to save wounds.');
                return;
            }
        }

        useEffect(() => setWounds(u.wounds), [u.wounds]);
        useEffect(() => setAbsent(!u.present), [u.present]);
        useEffect(() => setTmpLeader(Boolean(u.temporaryLeader)), [u.temporaryLeader]);
        useEffect(() => {
            const el = headerSpecialRef.current;
            if (!el) return;

            const update = () => {
                const next = Math.max(48, Math.round(el.getBoundingClientRect().height));
                setHeaderSpecialSize((prev) => (prev === next ? prev : next));
            };

            update();

            if (typeof ResizeObserver === 'undefined') {
                window.addEventListener('resize', update);
                return () => window.removeEventListener('resize', update);
            }

            const ro = new ResizeObserver(update);
            ro.observe(el);
            return () => ro.disconnect();
        }, [u.id]);
        useEffect(() => {
            if (!menuOpen) return;
            const onDown = (e: MouseEvent) => {
                const t = e.target as Node;
                if (menuBtnRef.current?.contains(t)) return;
                if (menuRef.current?.contains(t)) return;
                setMenuOpen(false);
            };
            const onKey = (e: KeyboardEvent) => {
                if (e.key === 'Escape') setMenuOpen(false);
            };
            window.addEventListener('mousedown', onDown);
            window.addEventListener('keydown', onKey);
            return () => {
                window.removeEventListener('mousedown', onDown);
                window.removeEventListener('keydown', onKey);
            };
        }, [menuOpen]);

        async function saveTemporaryLeader(next: boolean) {
            const prev = tmpLeader;
            setTmpLeader(next);

            const res = await fetch(`/api/units/${u.id}/temporary-leader`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ temporaryLeader: next }),
            }).catch(() => null);

            if (!res || !res.ok) {
                setTmpLeader(prev);
                notifyApiError('Failed to save Crew Leader.');
                return;
            }

            router.refresh();
        }

        const maxHp = u.base.hp + u.bonus.HP;
        const dmg = Math.max(0, Math.min(maxHp, wounds));
        const hpPlus = u.bonusPositive?.HP ?? Math.max(0, u.bonus.HP);
        const hpMinus = u.bonusNegative?.HP ?? Math.max(0, -u.bonus.HP);
        const weaponDisplays = useMemo(() => u.weapons.map((w) => computeWeaponDisplay(w)), [u.weapons]);
        const weaponTestHints = useMemo(
            () =>
                weaponDisplays.slice(0, 2).flatMap((d, idx) => {
                    const stat = parseTestSpecialStat(d.test);
                    return stat ? [{ weaponIndex: idx as 0 | 1, stat }] : [];
                }),
            [weaponDisplays],
        );

        function DmgBoxes() {
            return (
                <div
                    className="flex flex-wrap items-center gap-1"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    {/* 0 = full HP (no DMG). Each checked box = 1 DMG */}
                    {Array.from({ length: maxHp }, (_, i) => {
                        const idx = i + 1;
                        const checked = idx <= dmg;
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                    const nextDmg = checked && dmg === idx ? idx - 1 : idx;
                                    void saveWounds(Math.max(0, Math.min(maxHp, nextDmg)));
                                }}
                                className={
                                    'relative h-6 w-6 rounded-md transition-colors ' +
                                    (checked ? 'bg-red-950/40' : 'bg-zinc-950/90')
                                }
                                aria-label={checked ? `HP marker ${idx} (uncheck)` : `Set HP marker ${idx}`}
                                title={checked ? `HP marker ${idx}` : `Set HP marker: ${idx}`}
                            >
                                <span
                                    className={
                                        'absolute inset-0 grid place-items-center text-xs font-bold ' +
                                        (checked ? 'text-red-200' : 'text-zinc-400')
                                    }
                                >
                                    {checked ? 'x' : 'o'}
                                </span>
                                {checked && (
                                    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
                                        <span className="absolute left-1/2 top-1/2 h-[2px] w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-red-300/70" />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            );
        }

        return (
            <Link
                href={`/army/${aId}/unit/${u.id}`}
                className="block max-w-full overflow-hidden rounded-[22px] bg-zinc-900/60 p-3"
            >
                <div className="flex items-start gap-2">
                    <div
                        className="shrink-0 overflow-hidden rounded-xl bg-zinc-950/70"
                        style={{
                            width: headerSpecialSize,
                            minWidth: headerSpecialSize,
                            maxWidth: headerSpecialSize,
                            height: headerSpecialSize,
                            minHeight: headerSpecialSize,
                            maxHeight: headerSpecialSize,
                        }}
                    >
                        {!photoMissing ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={profileSrc}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                onError={() => setPhotoMissing(true)}
                            />
                        ) : (
                            <div className="grid h-full w-full place-items-center text-zinc-500">
                                <UserOutlined />
                            </div>
                        )}
                    </div>

                    <div ref={headerSpecialRef} className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="truncate text-base font-semibold leading-tight">{u.templateName}</div>
                            </div>

                            <div className="relative shrink-0">
                                <button
                                    ref={menuBtnRef}
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMenuOpen((v) => !v);
                                    }}
                                    className="inline-flex h-auto items-center justify-center p-0 text-zinc-300 hover:text-zinc-100"
                                    aria-label="Unit actions"
                                    title="Unit actions"
                                >
                                    <EllipsisOutlined className="text-[9px] leading-none" />
                                </button>
                                {menuOpen ? (
                                    <div
                                        ref={menuRef}
                                        className="absolute right-0 top-6 z-20 w-44 overflow-hidden rounded-xl bg-zinc-950 shadow-xl"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setMenuOpen(false);
                                                void savePresence(absent);
                                            }}
                                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                                        >
                                            <span>Absent</span>
                                            <span className={absent ? 'text-red-300' : 'text-zinc-500'}>{absent ? 'ON' : 'OFF'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setMenuOpen(false);
                                                void saveTemporaryLeader(!tmpLeader);
                                            }}
                                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                                        >
                                            <span>Crew Leader</span>
                                            <span className={tmpLeader ? 'text-emerald-300' : 'text-zinc-500'}>{tmpLeader ? 'ON' : 'OFF'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!canMoveUp || reordering}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setMenuOpen(false);
                                                onMoveUp();
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                                        >
                                            <UpOutlined />
                                            <span>Move up</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!canMoveDown || reordering}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setMenuOpen(false);
                                                onMoveDown();
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                                        >
                                            <DownOutlined />
                                            <span>Move down</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={deleting}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setMenuOpen(false);
                                                onDelete();
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-300 hover:bg-red-900/20 disabled:opacity-40"
                                        >
                                            <span>{deleting ? 'Deleting...' : 'Delete'}</span>
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="mt-1.5">
                            <SpecialCompact
                                base={u.base}
                                bonus={u.bonus}
                                bonusPositive={u.bonusPositive}
                                bonusNegative={u.bonusNegative}
                                hints={weaponTestHints}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-2 grid gap-2">
                    {u.weapons.map((w, idx) => {
                        const d = weaponDisplays[idx] ?? computeWeaponDisplay(w);
                        const typeParts = splitTypeAndRange(d.type);
                        const isMeleeWeapon = typeParts.type.toLowerCase().includes('melee');
                        const testStat = parseTestSpecialStat(d.test);
                        const accent = getWeaponAccent(idx);
                        return (
                            <div key={idx} className="overflow-hidden bg-zinc-950/55">
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <div className="text-sm font-medium text-zinc-100 sm:text-base">{w.name}</div>
                                    <div className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">{typeParts.type}</div>
                                </div>
                                <div className={isMeleeWeapon ? 'max-w-full overflow-x-hidden' : 'vault-scrollbar max-w-full overflow-x-auto'}>
                                    <table className="w-full table-fixed text-xs leading-tight sm:text-sm">
                                        <thead>
                                            <tr className="bg-teal-700/70 text-[13px] font-semibold uppercase tracking-wide text-teal-50">
                                                {!isMeleeWeapon ? <th className="w-[12%] px-1 py-1 text-left">Z</th> : null}
                                                <th className={(isMeleeWeapon ? 'w-[16%]' : 'w-[14%]') + ' px-1 py-1 text-left'}>Test</th>
                                                <th className={(isMeleeWeapon ? 'w-[43%]' : 'w-[38%]') + ' px-1 py-1 text-left'}>Traits</th>
                                                <th className={(isMeleeWeapon ? 'w-[41%]' : 'w-[36%]') + ' px-1 py-1 text-left'}>
                                                    <span className="sm:hidden">Crit</span>
                                                    <span className="hidden sm:inline">Critical Effect</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="align-top bg-zinc-950/80">
                                                {!isMeleeWeapon ? (
                                                    <td className="px-1 py-1 whitespace-normal break-all text-zinc-100">{typeParts.range || '-'}</td>
                                                ) : null}
                                                <td
                                                    className={
                                                        'px-1 py-1 whitespace-normal break-all ' +
                                                        (testStat ? accent.textBgClass + ' ' + accent.textClass : 'text-zinc-100')
                                                    }
                                                >
                                                    {d.test || '-'}
                                                </td>
                                                <td className="px-1 py-1 whitespace-normal break-all text-zinc-300">
                                                    <EffectsInline effects={d.allEffects} kind="WEAPON" />
                                                </td>
                                                <td className="px-1 py-1 whitespace-normal break-all text-zinc-300">
                                                    <EffectsInline effects={d.allEffects} kind="CRITICAL" />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-2 flex items-end gap-2">
                    <div className="min-w-0 flex flex-1 flex-wrap items-center gap-1">
                        <span className="whitespace-nowrap rounded-full bg-zinc-950 px-2 py-0.5 text-[11px] font-semibold text-zinc-200">
                            RATING {u.rating}
                        </span>
                        {(u.roleTag ?? '').toUpperCase() === 'CHAMPION' ? (
                            <span className="whitespace-nowrap rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                                CHAMPION
                            </span>
                        ) : null}
                        {u.isLeader ? (
                            <span className="whitespace-nowrap rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
                                LEADER
                            </span>
                        ) : null}
                        {tmpLeader ? (
                            <span className="whitespace-nowrap rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                                CREW LEADER
                            </span>
                        ) : null}
                        {absent ? (
                            <span className="whitespace-nowrap rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-200">
                                ABSENT
                            </span>
                        ) : null}
                    </div>
                    <div
                        className="shrink-0 flex items-center gap-2 text-sm"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <span className="text-zinc-400">HP</span>
                        {hpPlus > 0 || hpMinus > 0 ? (
                            <span className="relative inline-flex h-6 min-w-[1.25rem] items-center justify-center tabular-nums">
                                {hpPlus > 0 ? (
                                    <span className="absolute right-0 top-0 text-[10px] leading-none text-emerald-400">+{hpPlus}</span>
                                ) : null}
                                {hpMinus > 0 ? (
                                    <span className="absolute bottom-0 right-0 text-[10px] leading-none text-red-400">-{hpMinus}</span>
                                ) : null}
                            </span>
                        ) : null}
                        <DmgBoxes />
                    </div>
                </div>
            </Link>
        );
    }

    /* ====== Resource metadata ====== */
    const RESOURCE_META: Record<Kind, { label: string; hint: string; icon: React.ReactNode; quick: number[] }> = {
        caps: {
            label: 'CAPS',
            hint: 'Currency and barter budget.',
            icon: <DeploymentUnitOutlined className="text-zinc-200" />,
            quick: [-25, -10, 10, 25],
        },
        parts: {
            label: 'PARTS',
            hint: 'Crafting and upgrades.',
            icon: <AppstoreOutlined className="text-zinc-200" />,
            quick: [-10, -5, 5, 10],
        },
        scout: {
            label: 'SCOUT',
            hint: 'Scouting points and intel.',
            icon: <SearchOutlined className="text-zinc-200" />,
            quick: [-5, -1, 1, 5],
        },
        reach: {
            label: 'REACH',
            hint: 'Territory influence level.',
            icon: 'REACH',
            quick: [-5, -1, 1, 5],
        },
        exp: {
            label: 'XP',
            hint: 'Campaign experience.',
            icon: <StarOutlined className="text-zinc-200" />,
            quick: [-10, -5, 5, 10],
        },
        ploys: {
            label: 'PLOYS',
            hint: 'Available ploy tokens (max = army tier).',
            icon: <ThunderboltOutlined className="text-zinc-200" />,
            quick: [-1, 1],
        },
    };
    const STASH_RESOURCE_ORDER: CoreKind[] = ['caps', 'parts', 'scout', 'reach', 'exp'];
    const EDIT_RESOURCE_ORDER: CoreKind[] = ['caps', 'parts', 'scout', 'reach', 'exp'];

    const commonChems = useMemo(
        () =>
            [...chems]
                .filter((c) => c.rarity === 'COMMON')
                .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        [chems],
    );
    const uncommonChems = useMemo(
        () =>
            [...chems]
                .filter((c) => c.rarity === 'UNCOMMON')
                .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        [chems],
    );
    const chemSearch = chemQuery.trim().toLowerCase();
    const visibleCommonChems = useMemo(
        () =>
            commonChems.filter((chem) => {
                if (showOwnedChemsOnly && chem.quantity <= 0) return false;
                if (!chemSearch) return true;
                return (
                    chem.name.toLowerCase().includes(chemSearch) ||
                    chem.effect.toLowerCase().includes(chemSearch)
                );
            }),
        [commonChems, showOwnedChemsOnly, chemSearch],
    );
    const visibleUncommonChems = useMemo(
        () =>
            uncommonChems.filter((chem) => {
                if (showOwnedChemsOnly && chem.quantity <= 0) return false;
                if (!chemSearch) return true;
                return (
                    chem.name.toLowerCase().includes(chemSearch) ||
                    chem.effect.toLowerCase().includes(chemSearch)
                );
            }),
        [uncommonChems, showOwnedChemsOnly, chemSearch],
    );
    const ploysMax = Math.max(0, Math.floor(tier));
    const ploysChecked = Math.max(0, Math.min(ploysMax, totals.ploys ?? 0));

    // Lazy load chems only when Chems tab is opened.
    useEffect(() => {
        if (tab === 'EDIT' && !chemsLoaded) void loadChems();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, chemsLoaded]);

    /* ====== HOME TURF - state and methods ====== */
    const [hazardId, setHazardId] = useState<string | null>(null);
    const [hazardLegacy, setHazardLegacy] = useState<string>('');
    const [hazardsCatalog, setHazardsCatalog] = useState<UITurfDefinition[]>([]);
    const [facilityCatalog, setFacilityCatalog] = useState<UITurfDefinition[]>([]);
    const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
    const [legacyFacilities, setLegacyFacilities] = useState<UILegacyFacility[]>([]);
    const [savingHazard, setSavingHazard] = useState(false);
    const [loadingTurf, setLoadingTurf] = useState(false);
    const [updatingFacilityId, setUpdatingFacilityId] = useState<string | null>(null);
    const [deletingLegacyFacilityId, setDeletingLegacyFacilityId] = useState<string | null>(null);
    const [facilityPickerOpen, setFacilityPickerOpen] = useState(false);
    const [facilitySearch, setFacilitySearch] = useState('');

    function applyTurfData(data: HomeTurfResponse) {
        setHazardId(data.hazardId ?? null);
        setHazardLegacy(data.hazardLegacy ?? '');
        setHazardsCatalog(data.hazards ?? []);
        setFacilityCatalog(data.facilities ?? []);
        setSelectedFacilityIds(data.selectedFacilityIds ?? []);
        setLegacyFacilities(data.legacyFacilities ?? []);
    }

    async function loadTurf() {
        setLoadingTurf(true);
        try {
            const res = await fetch(`/api/armies/${armyId}/home-turf`, { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const data = (await res.json()) as HomeTurfResponse;
            applyTurfData(data);
        } catch {
            // noop
        } finally {
            setLoadingTurf(false);
        }
    }

    // Lazy load TURF
    useEffect(() => {
        if (tab === 'TURF') void loadTurf();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    async function saveHazard(nextHazardId: string | null) {
        const prev = hazardId;
        setHazardId(nextHazardId);
        setSavingHazard(true);
        try {
            const res = await fetch(`/api/armies/${armyId}/home-turf`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hazardId: nextHazardId }),
            });
            if (!res.ok) {
                const t = await res.text().catch(() => '');
                throw new Error(t || 'fail');
            }
            const data = (await res.json()) as HomeTurfResponse;
            applyTurfData(data);
        } catch {
            setHazardId(prev);
            notifyApiError('Failed to save hazard');
        } finally {
            setSavingHazard(false);
        }
    }

    async function toggleFacility(facilityId: string, selected: boolean) {
        const prev = selectedFacilityIds;
        setUpdatingFacilityId(facilityId);
        setSelectedFacilityIds((arr) =>
            selected ? Array.from(new Set([...arr, facilityId])) : arr.filter((id) => id !== facilityId),
        );
        try {
            const res = await fetch(`/api/armies/${armyId}/home-turf/facilities`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ facilityId, selected }),
            });
            if (!res.ok) throw new Error();
            const data = (await res.json()) as { selectedFacilityIds?: string[] };
            setSelectedFacilityIds(data.selectedFacilityIds ?? []);
        } catch {
            setSelectedFacilityIds(prev);
            notifyApiError('Failed to update facilities');
        } finally {
            setUpdatingFacilityId(null);
        }
    }

    async function deleteLegacyFacility(id: string) {
        confirmAction({
            title: 'Delete this legacy facility?',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onOk: async () => {
                setDeletingLegacyFacilityId(id);
                try {
                    const res = await fetch(`/api/armies/${armyId}/home-turf/facilities/${id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error();
                    setLegacyFacilities((arr) => arr.filter((x) => x.id !== id));
                } catch {
                    notifyApiError('Failed to delete legacy facility');
                    throw new Error('delete failed');
                } finally {
                    setDeletingLegacyFacilityId(null);
                }
            },
        });
    }

    const selectedHazard = useMemo(
        () => hazardsCatalog.find((h) => h.id === hazardId) ?? null,
        [hazardId, hazardsCatalog],
    );
    const selectedFacilitySet = useMemo(() => new Set(selectedFacilityIds), [selectedFacilityIds]);
    const selectedFacilities = useMemo(
        () => facilityCatalog.filter((f) => selectedFacilitySet.has(f.id)),
        [facilityCatalog, selectedFacilitySet],
    );
    const filteredFacilityCatalog = useMemo(() => {
        const q = facilitySearch.trim().toLowerCase();
        if (!q) return facilityCatalog;
        return facilityCatalog.filter((f) => (f.name + ' ' + f.description).toLowerCase().includes(q));
    }, [facilityCatalog, facilitySearch]);

    /* ====== TASKS (Goals) - state and methods ====== */
    const [goalsSet, setGoalsSet] = useState<{ id: string; name: string } | null>(null);
    const [currentTier, setCurrentTier] = useState<number>(tier);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loadingGoals, setLoadingGoals] = useState(false);
    const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null);

    async function loadGoals() {
        setLoadingGoals(true);
        try {
            const res = await fetch(`/api/armies/${armyId}/goals`, { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const data = (await res.json()) as GoalsResponse;
            setGoalsSet(data.set);
            setCurrentTier(data.currentTier);
            setGoals(data.goals ?? []);
        } catch {
            // noop
        } finally {
            setLoadingGoals(false);
        }
    }

    async function advanceTier() {
        confirmAction({
            title: 'Increase army tier?',
            content: 'Requires completing all tasks at the current tier.',
            okText: 'Increase tier',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    const res = await fetch(`/api/armies/${armyId}/tier`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'advance' }),
                    });
                    if (!res.ok) {
                        const json = (await res.json().catch(() => null)) as { error?: string } | null;
                        if (json?.error === 'TIER_NOT_COMPLETED') {
                            notifyWarning('You cannot increase tier: not all tasks at this tier are completed.');
                        } else if (json?.error === 'NO_ACTIVE_SET') {
                            notifyWarning('You cannot increase tier: not all tasks at this tier are completed.');
                        } else {
                            const t = await res.text().catch(() => '');
                            notifyApiError(t || 'Failed to increase tier.');
                        }
                        throw new Error('advance tier failed');
                    }

                    const updated = (await res.json().catch(() => null)) as { tier?: number } | null;
                    if (updated?.tier) setCurrentTier(updated.tier);
                    await loadGoals();
                    router.refresh();
                } catch {
                    throw new Error('tier failed');
                }
            }
        });
    }

    // Lazy load TASKS
    useEffect(() => {
        if (tab === 'TASKS') void loadGoals();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    async function setGoalTicks(goalId: string, next: number) {
        const g = goals.find((x) => x.id === goalId);
        if (!g) return;
        const clamped = Math.max(0, Math.min(g.target, next));
        if (clamped === g.ticks) return;

        setUpdatingGoalId(goalId);
        // optimistic UI
        setGoals((arr) => arr.map((x) => (x.id === goalId ? { ...x, ticks: clamped } : x)));
        try {
            const res = await fetch(`/api/armies/${armyId}/goals/${goalId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticks: clamped }),
            });
            if (!res.ok) throw new Error();
        } catch {
            // rollback
            setGoals((arr) => (g ? arr.map((x) => (x.id === goalId ? { ...x, ticks: g.ticks } : x)) : arr));
            notifyApiError('Failed to save goal progress');
        } finally {
            setUpdatingGoalId(null);
        }
    }

    const goalsByTier = useMemo(() => {
        const map: Record<1 | 2 | 3, Goal[]> = { 1: [], 2: [], 3: [] };
        for (const g of goals) map[g.tier].push(g);
        for (const t of [1, 2, 3] as const) map[t].sort((a, b) => a.order - b.order);
        return map;
    }, [goals]);

    function doneInTier(t: 1 | 2 | 3) {
        const arr = goalsByTier[t];
        if (arr.length === 0) return 0;
        return arr.filter((g) => g.ticks >= g.target).length;
    }

    function clearAllFilters() {
        setFilter('ALL');
        setHideInactive(false);
    }

    async function setPloys(next: number) {
        const clamped = Math.max(0, Math.min(ploysMax, Math.floor(next)));
        await setValue('ploys', clamped);
    }

    function PloysCheckboxCard() {
        const saving = busy === 'ploys';
        return (
            <div className="rounded-2xl bg-zinc-950 p-3">
                <div className="mb-2">
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
                            <span className="text-sm">{RESOURCE_META.ploys.icon}</span>
                            <span>{RESOURCE_META.ploys.label}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500">Tier {tier}</div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {Array.from({ length: ploysMax }, (_, i) => {
                        const idx = i + 1;
                        const checked = idx <= ploysChecked;
                        return (
                            <label key={idx} className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={saving}
                                    onChange={() => {
                                        const next = checked && ploysChecked === idx ? idx - 1 : idx;
                                        void setPloys(next);
                                    }}
                                    className="h-4 w-4 accent-emerald-500"
                                    aria-label={`Set ploys to ${idx}`}
                                />
                                <span>#{idx}</span>
                            </label>
                        );
                    })}
                    {ploysMax === 0 ? <span className="text-xs text-zinc-500">No ploys at tier 0.</span> : null}
                </div>
            </div>
        );
    }

    function renderResourceValueCard(kind: Kind) {
        const meta = RESOURCE_META[kind];
        const value = totals[kind];
        const saving = busy === kind;

        return (
            <div key={kind} className="rounded-xl bg-zinc-950 p-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
                        <span className="text-sm">{meta.icon}</span>
                        <span>{meta.label}</span>
                    </div>
                    <div className="tabular-nums text-2xl font-semibold leading-none text-zinc-100">{value}</div>
                </div>

                <div className="mt-2 grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
                    <button
                        className="h-10 w-10 shrink-0 rounded-lg bg-zinc-900 text-lg font-bold active:scale-95 disabled:opacity-40"
                        onClick={() => void setValue(kind, value - 1)}
                        disabled={saving}
                        aria-label={`Decrease ${meta.label}`}
                    >
                        -
                    </button>
                    <input
                        inputMode="numeric"
                        min={0}
                        aria-label={`${meta.label} value`}
                        value={value}
                        onChange={(e) =>
                            setTotals((t) => ({
                                ...t,
                                [kind]: Math.max(0, Math.floor(n(e.target.value, t[kind]))),
                            }))
                        }
                        onBlur={(e) => void setValue(kind, n(e.target.value, value))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                void setValue(kind, n((e.currentTarget as HTMLInputElement).value, value));
                            }
                        }}
                        className="h-10 min-w-0 vault-input px-3 text-center text-lg font-semibold tabular-nums"
                    />
                    <button
                        className="h-10 w-10 shrink-0 rounded-lg bg-zinc-900 text-lg font-bold active:scale-95 disabled:opacity-40"
                        onClick={() => void setValue(kind, value + 1)}
                        disabled={saving}
                        aria-label={`Increase ${meta.label}`}
                    >
                        +
                    </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                    {meta.quick.map((d) => (
                        <button
                            key={`${kind}_${d}`}
                            className="h-7 min-w-[3.25rem] rounded-lg bg-zinc-900 px-2 text-[11px] font-medium active:scale-95 disabled:opacity-50"
                            onClick={() => void setValue(kind, Math.max(0, value + d))}
                            disabled={saving}
                        >
                            {d > 0 ? `+${d}` : d}
                        </button>
                    ))}
                    <button
                        className="h-7 rounded-lg bg-zinc-900 px-2 text-[11px] font-medium text-zinc-400 active:scale-95 disabled:opacity-50"
                        onClick={() => void setValue(kind, 0)}
                        disabled={saving || value === 0}
                        title={`Reset ${meta.label}`}
                    >
                        Reset
                    </button>
                </div>
            </div>
        );
    }

    function ChemCheckboxGroup({ title, items }: { title: string; items: UIChem[] }) {
        const ownedCount = items.filter((chem) => chem.quantity > 0).length;
        return (
            <div className="rounded-2xl bg-zinc-950/35 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
                        {title}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                        Owned: {ownedCount}/{items.length}
                    </div>
                </div>
                <div className="space-y-2">
                    {items.map((chem) => {
                        const rowBusy = updatingChemId === chem.id;
                        const qty = Math.max(0, Math.min(3, chem.quantity));
                        const costLabel = `${Math.max(0, chem.costCaps ?? 0)} caps`;

                        function onDoseClick(idx: number) {
                            const checked = idx <= qty;
                            const next = checked ? idx - 1 : idx;
                            void setChemQuantity(chem.id, next);
                        }

                        return (
                            <div
                                key={chem.id}
                                className={
                                    'flex items-center gap-2 rounded-xl px-2.5 py-2 transition-colors ' +
                                    (qty > 0
                                        ? 'bg-emerald-500/10'
                                        : 'bg-zinc-900/70')
                                }
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="font-medium text-zinc-100">{chem.name}</div>
                                            {rowBusy ? <span className="text-[10px] text-emerald-300">Saving...</span> : null}
                                        </div>
                                        {chem.rarity === 'COMMON' ? (
                                            <div className="shrink-0 pt-0.5 text-[10px] text-zinc-500">{costLabel}</div>
                                        ) : null}
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        {([1, 2, 3] as const).map((idx) => (
                                            <label key={idx} className="inline-flex items-center gap-1 text-[11px] text-zinc-300">
                                                <input
                                                    type="checkbox"
                                                    checked={idx <= qty}
                                                    disabled={rowBusy}
                                                    onChange={() => onDoseClick(idx)}
                                                    className="h-4 w-4 accent-emerald-500"
                                                    aria-label={`Set ${chem.name} dose ${idx}`}
                                                />
                                                <span>{idx}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <StickyInfoTooltip title={chem.name} description={chem.effect} />
                            </div>
                        );
                    })}
                    {items.length === 0 ? <div className="text-xs text-zinc-500">No chems in this group.</div> : null}
                </div>
            </div>
        );
    }

    const hasActiveFilters = filter !== 'ALL' || hideInactive;

    useEffect(() => {
        onFiltersActiveChangeAction?.(hasActiveFilters);
    }, [hasActiveFilters, onFiltersActiveChangeAction]);

    useEffect(() => {
        onActionsReadyAction?.({
            openFilters: () => setFiltersOpen(true),
            clearFilters: () => clearAllFilters(),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <main className="mx-auto max-w-screen-sm overflow-x-hidden px-3 pb-24">
            {/* META */}
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-400">
                <div className="min-w-0 truncate">
                    <span className="font-medium text-zinc-300">{armyName}</span> | {factionName} | Tier {tier}
                </div>
                <div className="shrink-0 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px]">
                    Rating: <span className="font-semibold text-zinc-200">{displayRating}</span>
                </div>
            </div>

            {/* TABS */}
            <div className="mt-3 grid grid-cols-4 gap-2">
                {([
                    ['OVERVIEW', 'Overview'],
                    ['EDIT', 'Chems'],
                    ['TASKS', 'Tasks'],
                    ['TURF', 'Home Turf'],
                ] as [TabKey, string][]).map(([k, label]) => (
                    <button
                        key={k}
                        onClick={() => setTab(k)}
                        className={
                            'h-10 rounded-2xl text-xs font-medium tracking-wide ' +
                            (tab === k ? 'bg-emerald-500/15 text-emerald-200' : 'bg-zinc-900 text-zinc-300')
                        }
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* OVERVIEW */}
            {tab === 'OVERVIEW' && (
                <>
                    {/* STASH tracker */}
                    <section className="mt-3">
                        <div className="mb-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-100">Stash</div>
                        </div>
                        <div className="grid grid-cols-5 gap-3">
                            {STASH_RESOURCE_ORDER.map((k) => (
                                <button
                                    type="button"
                                    key={k}
                                    className="flex min-h-[74px] flex-col items-center justify-center rounded-xl bg-zinc-900/70 px-1 text-center transition-colors hover:bg-zinc-800/70"
                                    title={`${RESOURCE_META[k].label} (tap to edit)`}
                                    onClick={() => openResourceEditor(k)}
                                >
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
                                        {RESOURCE_META[k].label}
                                    </div>
                                    <div className="mt-1 tabular-nums text-lg font-semibold text-zinc-100">{totals[k]}</div>
                                </button>
                            ))}
                        </div>
                    </section>
                    {/* FILTER */}
                    <FilterBar
                        showTrigger={false}
                        open={filtersOpen}
                        onOpenChangeAction={setFiltersOpen}
                        controls={
                            <div className="grid grid-cols-2 gap-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
                                {(['ALL', 'CHAMPION', 'GRUNT', 'COMPANION', 'LEGENDS'] as RoleFilter[]).map((f) => (
                                    <QuickToggle key={f} checked={filter === f} onChangeAction={() => setFilter(f)} label={f} />
                                ))}
                            </div>
                        }
                        moreFilters={
                            <div className="min-w-0">
                                <QuickToggle
                                    checked={hideInactive}
                                    onChangeAction={setHideInactive}
                                    label="Chowaj nieaktywne (absent / dead)"
                                />
                            </div>
                        }
                        activeChips={[
                            ...(filter !== 'ALL' ? [{ key: 'role', label: `Role: ${filter}`, onRemove: () => setFilter('ALL') }] : []),
                            ...(hideInactive ? [{ key: 'inactive', label: 'Ukryte nieaktywne', onRemove: () => setHideInactive(false) }] : []),
                        ] as ActiveFilterChip[]}
                        onClearAllAction={clearAllFilters}
                    />

                    {/* UNITS */}
                    <section className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-base font-medium">Units</div>
                            <button onClick={() => setAdding(true)} className="rounded-xl bg-zinc-900 px-3 py-1 text-xs">
                                Add unit
                            </button>
                        </div>
                        <div className="mt-2 grid gap-2">
                            {filtered.map((u) => {
                                const idx = unitIndexById.get(u.id) ?? -1;
                                const canMoveUp = idx > 0;
                                const canMoveDown = idx >= 0 && idx < orderedUnits.length - 1;
                                return (
                                    <UnitRow
                                        key={u.id}
                                        u={u}
                                        armyId={armyId}
                                        deleting={deletingId === u.id}
                                        onDelete={() => void deleteUnit(u.id)}
                                        onPresenceChange={onUnitPresenceChange}
                                        onWoundsChange={onUnitWoundsChange}
                                        canMoveUp={canMoveUp}
                                        canMoveDown={canMoveDown}
                                        onMoveUp={() => void moveUnit(u.id, 'up')}
                                        onMoveDown={() => void moveUnit(u.id, 'down')}
                                        reordering={reordering}
                                    />
                                );
                            })}
                            {filtered.length === 0 && <div className="text-base text-zinc-500">No units for active filter</div>}
                        </div>
                    </section>
                </>
            )}

            {/* CHEMS */}
            {tab === 'EDIT' && (
                <section className="mt-3">
                    <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <MedicineBoxOutlined className="text-zinc-200" />
                                <span>Chems</span>
                            </div>
                            <div className="text-[11px] text-zinc-500">Quick tracking for common and uncommon chems.</div>
                        </div>
                        <button
                            onClick={() => void loadChems(true)}
                            className="rounded-xl bg-zinc-900 px-3 py-1 text-xs disabled:opacity-50"
                            disabled={loadingChems}
                        >
                            {loadingChems ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <input
                            value={chemQuery}
                            onChange={(e) => setChemQuery(e.target.value)}
                            placeholder="Search chems..."
                            className="h-10 min-w-[11rem] flex-1 rounded-xl bg-zinc-950 px-3 text-sm"
                        />
                        <label className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-3 text-xs text-zinc-300">
                            <input
                                type="checkbox"
                                checked={showOwnedChemsOnly}
                                onChange={(e) => setShowOwnedChemsOnly(e.target.checked)}
                            />
                            Owned only
                        </label>
                    </div>

                    {loadingChems && chems.length === 0 ? <div className="text-xs text-zinc-400">Loading chem list...</div> : null}

                    {!loadingChems && visibleCommonChems.length === 0 && visibleUncommonChems.length === 0 ? (
                        <div className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200">
                            No chems match active filters.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            <ChemCheckboxGroup title="Common chems" items={visibleCommonChems} />
                            <ChemCheckboxGroup title="Uncommon chems" items={visibleUncommonChems} />
                        </div>
                    )}
                </section>
            )}

            {/* TASKS - goal progress tracking */}
            {tab === 'TASKS' && (
                <section className="mt-3">
                    <div className="mb-1 flex items-center justify-between">
                        <div className="text-sm font-medium">Tasks</div>
                        <button
                            onClick={() => void loadGoals()}
                            className="rounded-xl bg-zinc-900 px-3 py-1 text-xs"
                            aria-label="Refresh goals"
                            title="Refresh"
                        >
                            Refresh
                        </button>
                    </div>

                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-xs text-zinc-400">
                            Current tier: <span className="font-semibold text-zinc-200">T{currentTier}</span>
                        </div>
                        <button
                            onClick={() => void advanceTier()}
                            className="rounded-xl bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 active:scale-95"
                            aria-label="Increase tier"
                            title="Increase tier"
                        >
                            Increase tier
                        </button>
                    </div>

                    <div className="mb-3 rounded-xl bg-zinc-950/35 p-2.5">
                        <div className="text-sm font-medium">Faction limits (active tier: T{tier})</div>
                        <FactionLimitsTable limits={factionLimits} activeTier={tier} />
                    </div>

                    {loadingGoals && <div className="text-xs text-zinc-400">Loading...</div>}

                    {!loadingGoals && !goalsSet && (
                        <div className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">
                            No active goal set for this army.
                        </div>
                    )}

                    {!loadingGoals && goalsSet && (
                        <>
                            <div className="rounded-xl bg-zinc-950/35 p-2.5 text-xs text-zinc-300">
                                <div>
                                    Set: <span className="font-semibold text-zinc-200">{goalsSet.name}</span>
                                </div>
                                <div className="mt-1">
                                    Current army tier: <span className="font-semibold text-zinc-200">T{currentTier}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                                    {[1, 2, 3].map((t) => (
                                        <span key={t} className="rounded-full bg-zinc-900/70 px-2 py-0.5">
                      T{t}: {doneInTier(t as 1 | 2 | 3)}/{goalsByTier[t as 1 | 2 | 3].length} completed
                    </span>
                                    ))}
                                </div>
                            </div>

                            {[1, 2, 3].map((t) => {
                                const arr = goalsByTier[t as 1 | 2 | 3];
                                if (arr.length === 0) return null;
                                return (
                                    <div key={t} className="mt-4">
                                        <div className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-400">TIER {t}</div>
                                        <div className="grid gap-2">
                                            {arr.map((g) => {
                                                const filled = g.ticks;
                                                const total = g.target;
                                                return (
                                                    <div key={g.id} className="rounded-xl bg-zinc-950/45 p-2">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="text-sm text-zinc-100">{g.description}</div>
                                                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                                    {Array.from({ length: total }, (_, i) => {
                                                                        const val = i + 1; // 1..target
                                                                        const active = filled >= val;
                                                                        return (
                                                                            <button
                                                                                key={i}
                                                                                onClick={() => void setGoalTicks(g.id, active && filled === val ? val - 1 : val)}
                                                                                disabled={updatingGoalId === g.id}
                                                                                className={
                                                                                    'h-6 w-6 rounded-full text-xs tabular-nums ' +
                                                                                    (active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-zinc-900 text-zinc-400')
                                                                                }
                                                                                title={active ? `Revert to ${val - 1}` : `Set to ${val}`}
                                                                                aria-label={active ? `Revert to ${val - 1}` : `Set to ${val}`}
                                                                            >
                                                                                {val}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                            <div className="shrink-0 text-xs text-zinc-400">
                                                                {filled}/{total}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </section>
            )}

            {/* TURF */}
            {tab === 'TURF' && (
                <section className="mt-3">
                    <div className="text-sm font-medium">Home Turf</div>

                    <div className="mt-3">
                        <label className="text-xs text-zinc-400">Hazard</label>
                        <select
                            value={hazardId ?? ''}
                            onChange={(e) => void saveHazard(e.target.value || null)}
                            className="mt-1 w-full vault-input px-3 py-2 text-sm"
                            disabled={savingHazard || loadingTurf}
                        >
                            <option value="">No hazard selected</option>
                            {hazardsCatalog.map((h) => (
                                <option key={h.id} value={h.id}>
                                    {h.name}
                                </option>
                            ))}
                        </select>
                        <div className="mt-2 flex items-center gap-2">
                            {savingHazard ? <span className="text-xs text-emerald-300">Saving hazard...</span> : null}
                            {loadingTurf && <span className="text-xs text-zinc-500">Loading...</span>}
                        </div>
                    </div>

                    {selectedHazard ? (
                        <div className="mt-3 rounded-xl bg-zinc-950/40 p-3">
                            <div className="mb-2 text-sm font-medium text-zinc-100">{selectedHazard.name}</div>
                            <RuleDescription text={selectedHazard.description} />
                        </div>
                    ) : null}

                    {!selectedHazard && hazardLegacy.trim() ? (
                        <div className="mt-3 rounded-xl bg-amber-500/10 p-3">
                            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-amber-200">
                                Legacy hazard text
                            </div>
                            <RuleDescription text={hazardLegacy} />
                        </div>
                    ) : null}

                    <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">Facilities</div>
                            <button
                                type="button"
                                onClick={() => setFacilityPickerOpen(true)}
                                className="rounded-xl bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950"
                            >
                                Add facility
                            </button>
                        </div>

                        <div className="grid gap-2">
                            {selectedFacilities.map((f) => {
                                const rowBusy = updatingFacilityId === f.id;
                                return (
                                    <div
                                        key={f.id}
                                        className="rounded-xl bg-emerald-500/10 p-3 transition-colors"
                                    >
                                        <div className="mb-2 flex items-start justify-between gap-2">
                                            <div className="text-sm font-medium text-zinc-100">{f.name}</div>
                                            {rowBusy ? <span className="text-xs text-emerald-300">Saving...</span> : null}
                                            <button
                                                type="button"
                                                onClick={() => void toggleFacility(f.id, false)}
                                                disabled={rowBusy}
                                                className="shrink-0 rounded-lg bg-red-900/20 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-900/30 disabled:opacity-50"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <RuleDescription text={f.description} />
                                    </div>
                                );
                            })}
                            {selectedFacilities.length === 0 ? (
                                <div className="text-sm text-zinc-500">No facilities selected.</div>
                            ) : null}
                        </div>

                        {legacyFacilities.length > 0 ? (
                            <div className="mt-3 rounded-xl bg-amber-500/10 p-3">
                                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-200">
                                    Legacy facilities
                                </div>
                                <div className="mt-2 grid gap-2">
                                    {legacyFacilities.map((f) => (
                                        <div
                                            key={f.id}
                                            className="flex items-center justify-between rounded-lg bg-zinc-950/55 px-3 py-2"
                                        >
                                            <div className="text-sm text-zinc-200">{f.name}</div>
                                            <button
                                                onClick={() => void deleteLegacyFacility(f.id)}
                                                disabled={deletingLegacyFacilityId === f.id}
                                                className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-red-300 hover:bg-red-600/10 disabled:opacity-50"
                                            >
                                                {deletingLegacyFacilityId === f.id ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </section>
            )}

            {resourceEditorKind && (
                <div className="fixed inset-0 z-30 overflow-x-hidden">
                    <button aria-label="Close" onClick={closeResourceEditor} className="absolute inset-0 bg-black/60" />
                    <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-screen-sm rounded-t-3xl bg-zinc-900 p-4 shadow-xl">
                        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                                <div className="text-sm font-semibold">{RESOURCE_META[resourceEditorKind].label}</div>
                                <div className="text-[11px] text-zinc-500">{RESOURCE_META[resourceEditorKind].hint}</div>
                            </div>
                            <button
                                onClick={closeResourceEditor}
                                className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                            >
                                Close
                            </button>
                        </div>

                        <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
                            <button
                                type="button"
                                className="h-11 w-11 rounded-xl bg-zinc-900 text-xl font-bold"
                                onClick={() => shiftResourceDraft(-1)}
                                aria-label={`Decrease ${RESOURCE_META[resourceEditorKind].label}`}
                            >
                                -
                            </button>
                            <input
                                inputMode="numeric"
                                min={0}
                                value={resourceDraft}
                                onChange={(e) => setResourceDraft(String(Math.max(0, n(e.target.value, totals[resourceEditorKind]))))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void saveResourceEditor();
                                    }
                                }}
                                className="h-11 rounded-xl bg-zinc-950 px-3 text-center text-xl font-semibold tabular-nums"
                            />
                            <button
                                type="button"
                                className="h-11 w-11 rounded-xl bg-zinc-900 text-xl font-bold"
                                onClick={() => shiftResourceDraft(1)}
                                aria-label={`Increase ${RESOURCE_META[resourceEditorKind].label}`}
                            >
                                +
                            </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {RESOURCE_META[resourceEditorKind].quick.map((d) => (
                                <button
                                    key={`${resourceEditorKind}_${d}`}
                                    type="button"
                                    className="h-7 min-w-[3.25rem] rounded-lg bg-zinc-900 px-2 text-[11px] font-medium"
                                    onClick={() => shiftResourceDraft(d)}
                                >
                                    {d > 0 ? `+${d}` : d}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={closeResourceEditor}
                                className="h-11 rounded-2xl bg-zinc-900 text-sm text-zinc-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void saveResourceEditor()}
                                disabled={busy === resourceEditorKind}
                                className="h-11 rounded-2xl bg-emerald-500 text-sm font-semibold text-emerald-950 disabled:opacity-40"
                            >
                                {busy === resourceEditorKind ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {facilityPickerOpen && (
                <div className="fixed inset-0 z-30 overflow-x-hidden">
                    <button
                        aria-label="Close"
                        onClick={() => setFacilityPickerOpen(false)}
                        className="absolute inset-0 bg-black/60"
                    />

                    <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[88dvh] w-full max-w-screen-sm flex-col overflow-x-hidden rounded-t-3xl bg-zinc-900 shadow-xl">
                        <div className="p-4 pb-3">
                            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-sm font-semibold">Add facility</div>
                                    <div className="mt-0.5 text-[11px] text-zinc-400">Search and add Home Turf facilities.</div>
                                </div>
                                <button
                                    onClick={() => setFacilityPickerOpen(false)}
                                    className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="mt-3">
                                <div className="flex items-center gap-2 rounded-2xl bg-zinc-950 px-3 py-2">
                                    <SearchOutlined className="text-zinc-400" />
                                    <input
                                        value={facilitySearch}
                                        onChange={(e) => setFacilitySearch(e.target.value)}
                                        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                                        placeholder="Search facility..."
                                    />
                                    {facilitySearch && (
                                        <button
                                            onClick={() => setFacilitySearch('')}
                                            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 active:scale-95"
                                            aria-label="Clear"
                                        >
                                            <CloseOutlined />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-3 text-[11px] text-zinc-500">
                                Results: <span className="font-semibold text-zinc-300">{filteredFacilityCatalog.length}</span>
                            </div>
                        </div>

                        <div className="vault-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
                            <div className="grid gap-2">
                                {filteredFacilityCatalog.map((f) => {
                                    const selected = selectedFacilitySet.has(f.id);
                                    const rowBusy = updatingFacilityId === f.id;
                                    const canAdd = !selected && !rowBusy;
                                    return (
                                        <div key={f.id} className="rounded-xl bg-zinc-950 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="font-medium">{f.name}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={!canAdd}
                                                    onClick={() => void toggleFacility(f.id, true)}
                                                    className={
                                                        'shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ' +
                                                        (canAdd
                                                            ? 'bg-emerald-500 text-emerald-950'
                                                            : 'bg-zinc-900 text-zinc-500')
                                                    }
                                                >
                                                    {selected ? 'Added' : rowBusy ? 'Adding...' : 'Add'}
                                                </button>
                                            </div>
                                            <div className="mt-2">
                                                <RuleDescription text={f.description} />
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredFacilityCatalog.length === 0 ? (
                                    <div className="rounded-xl bg-zinc-950 p-3 text-sm text-zinc-500">
                                        No facilities for current search.
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {adding && (
                <AddUnitSheet
                    armyId={armyId}
                    factionId={factionId}
                    subfactionId={subfactionId ?? null}
                    onClose={() => {
                        setAdding(false);
                        router.refresh();
                    }}
                />
            )}
        </main>
    );
}

/* ================== AddUnitSheet ================== */

type UITemplate = {
    id: string;
    name: string;
    roleTag: 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS' | null;
    isLeader?: boolean;
    factionId: string | null;
    stats: { hp: number; s: number; p: number; e: number; c: number; i: number; a: number; l: number };
    options: {
        id: string;
        costCaps: number;
        rating: number | null;
        weapon1Id: string;
        weapon1Name: string;
        weapon2Id: string | null;
        weapon2Name: string | null;
        weapon1: UIWeaponTemplate | null;
        weapon2: UIWeaponTemplate | null;
    }[];
};

type UIWeaponTemplateEffect = {
    effectId: string;
    valueInt: number | null;
    valueText?: string | null;
    effectMode?: 'ADD' | 'REMOVE';
    effect: { id: string; name: string; kind: 'WEAPON' | 'CRITICAL'; description: string; requiresValue: boolean };
};

type UIWeaponTemplateProfile = {
    id: string;
    order: number;
    typeOverride: string | null;
    testOverride: string | null;
    partsOverride: number | null;
    ratingDelta: number | null;
    effects: UIWeaponTemplateEffect[];
};

type UIWeaponTemplate = {
    id: string;
    name: string;
    imagePath: string | null;
    notes: string | null;
    baseType: string;
    baseTest: string;
    baseParts: number | null;
    baseRating: number | null;
    baseEffects: UIWeaponTemplateEffect[];
    profiles: UIWeaponTemplateProfile[];
};

type Paged<T> = { items: T[]; nextCursor: string | null };

function AddUnitSheet({
    armyId,
    factionId,
    subfactionId,
    onClose,
}: {
    armyId: string;
    factionId: string;
    subfactionId: string | null;
    onClose: () => void;
}) {
    const pageSize = 25;

    const [list, setList] = useState<UITemplate[]>([]);
    const [q, setQ] = useState('');
    const [roleTag, setRoleTag] = useState<'ALL' | 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS'>('ALL');

    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);

    const [selT, setSelT] = useState<string | null>(null);
    const [selO, setSelO] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const inFlightRef = useRef(false);

    function buildQs(nextCursor: string | null) {
        const qs = new URLSearchParams({
            factionId,
            limit: String(pageSize),
        });
        qs.set('expand', 'weapons');
        if (subfactionId) qs.set('subfactionId', subfactionId);
        if (q.trim()) qs.set('q', q.trim());
        if (roleTag !== 'ALL') qs.set('roleTag', roleTag);
        if (nextCursor) qs.set('cursor', nextCursor);
        return qs;
    }

    async function loadNext(reset = false) {
        if (inFlightRef.current) return;
        if (!hasMore && !reset) return;

        inFlightRef.current = true;
        setLoading(true);
        try {
            const nextCur = reset ? null : cursor;
            const res = await fetch(`/api/unit-templates?${buildQs(nextCur).toString()}`, { cache: 'no-store' });
            if (!res.ok) return;

            const json = (await res.json()) as Paged<UITemplate> | UITemplate[];

            const payload: Paged<UITemplate> = Array.isArray(json)
                ? { items: json, nextCursor: null }
                : json;

            setList((prev) => {
                const base = reset ? [] : prev;
                const byId = new Map<string, UITemplate>();
                for (const x of base) byId.set(x.id, x);
                for (const x of payload.items) byId.set(x.id, x);
                return [...byId.values()];
            });
            setCursor(payload.nextCursor);
            setHasMore(Boolean(payload.nextCursor));
        } finally {
            setLoading(false);
            inFlightRef.current = false;
        }
    }

    // initial + on filter change => reset
    useEffect(() => {
        setList([]);
        setCursor(null);
        setHasMore(true);
        setSelT(null);
        setSelO(null);
        void loadNext(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [factionId, subfactionId, roleTag, q]);

    // infinite scroll (IntersectionObserver)
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (first?.isIntersecting) void loadNext(false);
            },
            { root: null, rootMargin: '200px', threshold: 0 },
        );
        obs.observe(el);
        return () => obs.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sentinelRef.current, cursor, hasMore, loading]);

    const selected = list.find((t) => t.id === selT) ?? null;
    const can = Boolean(selT && selO);

    async function add() {
        if (!selected || !selO) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/armies/${armyId}/units`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unitTemplateId: selected.id, optionId: selO }),
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                notifyApiError(txt, 'Failed to add unit');
                return;
            }
            onClose();
        } finally {
            setBusy(false);
        }
    }

    const RoleChip = ({ k, label }: { k: typeof roleTag; label: string }) => (
        <button
            type="button"
            onClick={() => setRoleTag(k)}
            className={
                'h-9 rounded-full px-3 text-xs font-medium ' +
                (roleTag === k ? 'bg-emerald-500/10 text-emerald-200' : 'bg-zinc-950 text-zinc-300')
            }
        >
            {label}
        </button>
    );

    function formatEffectName(name: string, valueInt: number | null, valueText?: string | null): string {
        let out = name;
        if (valueInt != null) {
            const replaced = out.replace(/\(\s*X\s*\)/g, String(valueInt)).replace(/\bX\b/g, String(valueInt));
            out = replaced !== out ? replaced : `${out} (${valueInt})`;
        }
        if (valueText && valueText.trim()) {
            out += ` [${valueText.trim()}]`;
        }
        return out;
    }

    function WeaponDetails({ w }: { w: UIWeaponTemplate | null }) {
        if (!w) return <div className="text-[11px] text-zinc-500">No weapon data</div>;

        function EffectSpan({ e, prefix = '', className = '' }: { e: UIWeaponTemplateEffect; prefix?: string; className?: string }) {
            const label = `${prefix}${formatEffectName(e.effect.name, e.valueInt, e.valueText)}`;
            return (
                <EffectTooltip
                    effectId={e.effect.id}
                    label={label}
                    className={`cursor-help underline decoration-dotted underline-offset-2 ${className}`.trim()}
                />
            );
        }

        const baseTraits = (w.baseEffects ?? []).filter((e) => e.effect.kind === 'WEAPON');
        const baseCrits = (w.baseEffects ?? []).filter((e) => e.effect.kind === 'CRITICAL');

        const rows = [
            {
                kind: 'BASE' as const,
                key: 'BASE',
                type: w.baseType || '-',
                test: w.baseTest || '-',
                parts: w.baseParts,
                rating: w.baseRating,
                traits: baseTraits,
                crits: baseCrits,
            },
            ...(w.profiles ?? [])
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((p) => {
                    const pTraits = (p.effects ?? []).filter((e) => e.effect.kind === 'WEAPON');
                    const pCrits = (p.effects ?? []).filter((e) => e.effect.kind === 'CRITICAL');
                    return {
                        kind: 'PROFILE' as const,
                        key: p.id,
                        order: p.order,
                        type: p.typeOverride,
                        test: p.testOverride,
                        parts: p.partsOverride,
                        rating: p.ratingDelta,
                        traits: pTraits,
                        crits: pCrits,
                    };
                }),
        ];

        function splitTypeAndRange(raw: string | null | undefined): { type: string; woundsge: string } {
            const text = (raw ?? '').trim();
            if (!text) return { type: '-', woundsge: '-' };

            const woundsgeMatch = text.match(/\(([^)]*)\)/);
            const woundsge = woundsgeMatch?.[1]?.trim() ?? '-';

            const type = text
                .replace(/\([^)]*\)/g, '')
                .replace(/\s*-\s*$/g, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

            return { type: type || '-', woundsge };
        }

        const typeLabels = rows.map((r) => splitTypeAndRange(r.type).type).filter((t) => t !== '-');
        const uniqTypes = [...new Set(typeLabels)];
        const weaponTypeLabel = uniqTypes.length === 0 ? '-' : uniqTypes.length === 1 ? uniqTypes[0] : `${uniqTypes[0]}+`;
        const isMeleeWeapon = typeLabels.some((t) => t.toLowerCase().includes('melee'));

        const renderEffects = (arr: UIWeaponTemplateEffect[]) => {
            if (!arr.length) return <span>-</span>;
            return (
                <div className="space-y-0.5">
                    {arr.map((t, i) => (
                        <div key={`${t.effectId}_${i}`} className="whitespace-normal break-all">
                            {(t.effectMode ?? 'ADD') === 'REMOVE' ? (
                                <EffectSpan e={t} prefix="- " className="text-red-300" />
                            ) : (
                                <EffectSpan e={t} />
                            )}
                        </div>
                    ))}
                </div>
            );
        };

        return (
            <div className="mt-1 overflow-hidden rounded-xl bg-zinc-950">
                <div className="flex items-center gap-2 px-2 py-1.5">
                    <div className="text-xs font-medium text-zinc-100 sm:text-sm">{w.name}</div>
                    <div className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">{weaponTypeLabel}</div>
                </div>
                <div className="vault-scrollbar max-w-full overflow-x-auto">
                    <table className="w-full table-fixed text-[10px] leading-tight sm:text-xs">
                        <thead>
                            <tr className="bg-teal-700/70 text-[11px] font-semibold uppercase tracking-wide text-teal-50">
                                {!isMeleeWeapon ? <th className="w-[10%] px-1 py-1 text-left">Z</th> : null}
                                <th className={(isMeleeWeapon ? 'w-[16%]' : 'w-[12%]') + ' px-1 py-1 text-left'}>Test</th>
                                <th className={(isMeleeWeapon ? 'w-[34%]' : 'w-[30%]') + ' px-1 py-1 text-left'}>Traits</th>
                                <th className={(isMeleeWeapon ? 'w-[30%]' : 'w-[28%]') + ' px-1 py-1 text-left'}>
                                    <span className="sm:hidden">Crit</span>
                                    <span className="hidden sm:inline">Critical Effect</span>
                                </th>
                                <th className={(isMeleeWeapon ? 'w-[10%]' : 'w-[10%]') + ' px-1 py-1 text-center'}>P</th>
                                <th className={(isMeleeWeapon ? 'w-[10%]' : 'w-[10%]') + ' px-1 py-1 text-center'}>R</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const { woundsge } = splitTypeAndRange(r.type);
                                return (
                                    <tr key={r.key} className="align-top bg-zinc-950">
                                        {!isMeleeWeapon ? <td className="px-1 py-1 whitespace-normal break-all text-zinc-100">{woundsge || '-'}</td> : null}
                                        <td className="px-1 py-1 whitespace-normal break-all text-zinc-100">{r.test || '-'}</td>
                                        <td className="px-1 py-1 whitespace-normal break-all text-zinc-300">{renderEffects(r.traits)}</td>
                                        <td className="px-1 py-1 whitespace-normal break-all text-zinc-300">{renderEffects(r.crits)}</td>
                                        <td className="px-1 py-1 text-center tabular-nums">{r.parts != null ? r.parts : '-'}</td>
                                        <td className="px-1 py-1 text-center tabular-nums">{r.rating != null ? r.rating : '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
    function SpecialRow({ t }: { t: UITemplate }) {
        const s = t.stats;
        return (
            <div className="mt-2 overflow-hidden rounded-xl bg-zinc-950">
                <div className="grid grid-cols-8 bg-teal-700/70 text-teal-50 text-[11px] font-semibold tracking-widest">
                    {['S','P','E','C','I','A','L','HP'].map((h) => (
                        <div key={h} className="px-2 py-1 text-center">{h}</div>
                    ))}
                </div>
                <div className="grid grid-cols-8 bg-zinc-950 text-sm text-zinc-100">
                    <div className="px-2 py-1 text-center tabular-nums">{s.s}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.p}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.e}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.c}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.i}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.a}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.l}</div>
                    <div className="px-2 py-1 text-center tabular-nums">{s.hp}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-20 overflow-x-hidden">
            <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />

            <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[92dvh] w-full max-w-screen-sm flex-col overflow-x-hidden rounded-t-3xl bg-zinc-900 shadow-xl">
                <div className="p-4 pb-3">
                    <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <div className="text-sm font-semibold">Add unit</div>
                            <div className="mt-0.5 text-[11px] text-zinc-400">Select a unit and loadout package.</div>
                        </div>
                        <button onClick={onClose} className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                            Close
                        </button>
                    </div>

                    <div className="mt-3">
                        <div className="flex items-center gap-2 rounded-2xl bg-zinc-950 px-3 py-2">
                            <SearchOutlined className="text-zinc-400" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                                placeholder="Search units..."
                            />
                            {q && (
                                <button onClick={() => setQ('')} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 active:scale-95" aria-label="Clear">
                                    <CloseOutlined />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <RoleChip k="ALL" label="All" />
                        <RoleChip k="CHAMPION" label="Champion" />
                        <RoleChip k="GRUNT" label="Grunt" />
                        <RoleChip k="COMPANION" label="Companion" />
                        <RoleChip k="LEGENDS" label="Legends" />
                     </div>
                </div>

                <div className="vault-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-4 pb-3">
                    <div className="grid gap-2">
                        {list.map((t) => {
                            const isSel = t.id === selT;
                            const initials = t.name
                                .split(' ')
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((x) => x[0]!.toUpperCase())
                                .join('');

                            return (
                                <div key={t.id} className={'rounded-2xl ' + (isSel ? 'bg-emerald-500/5' : 'bg-zinc-900')}>
                                    <button
                                        onClick={() => {
                                            setSelT(t.id);
                                            setSelO(null);
                                        }}
                                        className="flex w-full items-center gap-3 p-3 text-left"
                                    >
                                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-950 text-sm font-semibold text-zinc-200">
                                            {initials || 'U'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium">{t.name}</div>
                                            <div className="mt-0.5 text-[11px] text-zinc-400">
                                                <span className="inline-flex flex-wrap items-center gap-1.5">
                                                    <span>{t.roleTag ? t.roleTag : '-'}</span>
                                                    {t.isLeader ? (
                                                        <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                                                            LEADER
                                                        </span>
                                                    ) : null}
                                                    <span>| {t.options.length} options</span>
                                                </span>
                                             </div>
                                             {isSel && <SpecialRow t={t} />}
                                         </div>
                                        <div className="text-xs text-zinc-400">{isSel ? <UpOutlined /> : <DownOutlined />}</div>
                                    </button>

                                    {isSel && (
                                        <div className="bg-zinc-950 p-2">
                                            {t.options.map((o) => {
                                                const checked = selO === o.id;
                                                return (
                                                    <label
                                                        key={o.id}
                                                        className={
                                                            'mb-2 block rounded-xl p-2 ' +
                                                            (checked ? 'bg-emerald-500/10' : 'bg-zinc-900')
                                                        }
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <input
                                                                type="radio"
                                                                name={`opt_${t.id}`}
                                                                checked={checked}
                                                                onChange={() => setSelO(o.id)}
                                                                className="mt-1"
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-sm font-medium">
                                                                    {o.weapon1Name}
                                                                    {o.weapon2Name ? ` + ${o.weapon2Name}` : ''}
                                                                </div>
                                                                <div className="mt-0.5 text-[11px] text-zinc-400">
                                                                    Cost {o.costCaps}
                                                                    {o.rating != null ? ` | Rating ${o.rating}` : ''}
                                                                </div>

                                                                <div className="mt-2 grid gap-2">
                                                                    <div>
                                                                        <div className="text-[11px] font-semibold text-zinc-300">Weapon 1</div>
                                                                        <WeaponDetails w={o.weapon1} />
                                                                    </div>
                                                                    {o.weapon2Name && (
                                                                        <div>
                                                                            <div className="text-[11px] font-semibold text-zinc-300">Weapon 2</div>
                                                                            <WeaponDetails w={o.weapon2} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}

                                            {t.options.length === 0 && <div className="text-sm text-zinc-500">No loadout options.</div>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {list.length === 0 && !loading && <div className="text-sm text-zinc-500">No results.</div>}
                    </div>

                    <div ref={sentinelRef} className="h-12" />

                    {loading && <div className="py-3 text-center text-xs text-zinc-400">Loading...</div>}
                    {!hasMore && list.length > 0 && <div className="py-3 text-center text-xs text-zinc-500">To wszystko.</div>}
                </div>

                <div className="bg-zinc-900 p-4">
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="h-11 flex-1 rounded-2xl bg-zinc-800 text-sm text-zinc-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => void add()}
                            disabled={!can || busy}
                            className="h-11 flex-1 rounded-2xl bg-emerald-500 text-sm font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {busy ? 'Adding...' : 'Add'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
