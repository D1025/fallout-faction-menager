'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Portal } from '@/components/ui/Portal';

export type EffectInfo = {
    id: string;
    name: string;
    kind: 'WEAPON' | 'CRITICAL';
    description: string;
    requiresValue: boolean;
};

const cache = new Map<string, EffectInfo>();

async function fetchEffects(ids: string[]): Promise<Map<string, EffectInfo>> {
    const unique = Array.from(new Set(ids)).filter((x) => x && !cache.has(x));
    if (unique.length === 0) return cache;

    const qs = unique.map((id) => `id=${encodeURIComponent(id)}`).join('&');
    const res = await fetch(`/api/effects?${qs}`, { cache: 'no-store' });
    if (!res.ok) return cache;
    const data = (await res.json()) as { items: EffectInfo[] };
    for (const it of data.items) cache.set(it.id, it);
    return cache;
}

function wrapX(desc: string): string {
    return desc.replace(/\bX\b/g, 'X');
}

type Pos = { top: number; left: number; maxWidth: number };

export function EffectTooltip({
    effectId,
    label,
    className,
}: {
    effectId: string;
    label: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [info, setInfo] = useState<EffectInfo | null>(() => cache.get(effectId) ?? null);
    const rootRef = useRef<HTMLSpanElement | null>(null);
    const [pos, setPos] = useState<Pos | null>(null);

    useEffect(() => {
        let alive = true;
        if (cache.has(effectId)) {
            setInfo(cache.get(effectId)!);
            return;
        }
        void (async () => {
            const m = await fetchEffects([effectId]);
            if (!alive) return;
            setInfo(m.get(effectId) ?? null);
        })();
        return () => {
            alive = false;
        };
    }, [effectId]);

    // close on outside click / Esc (important on mobile)
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent | TouchEvent) => {
            const t = e.target as Node;
            if (rootRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('mousedown', onDown);
        window.addEventListener('touchstart', onDown, { passive: true });
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('touchstart', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const desc = useMemo(() => {
        if (!info) return 'Loading description...';
        return wrapX(info.description);
    }, [info]);

    function computePos() {
        const el = rootRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();

        const margin = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // responsive width
        const maxWidth = Math.min(360, Math.max(240, Math.floor(vw * 0.88)));

        // center by anchor on narrow screens, with clamping
        const anchorCenter = r.left + r.width / 2;
        let left = anchorCenter - maxWidth / 2;
        left = Math.max(margin, Math.min(left, vw - maxWidth - margin));

        // FLIP: if there is not enough space below, try above anchor
        const desiredHeight = 140; // heuristic; actual height depends on content
        const belowTop = r.bottom + 8;
        const aboveTop = r.top - 8 - desiredHeight;

        const hasRoomBelow = belowTop + desiredHeight + margin <= vh;
        const top = hasRoomBelow ? belowTop : Math.max(margin, aboveTop);

        setPos({ top, left, maxWidth });
    }

    useEffect(() => {
        if (!open) return;
        computePos();
        const onScroll = () => computePos();
        const onResize = () => computePos();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
    }, [open]);

    return (
        <>
            <span
                ref={rootRef}
                className={
                    'relative inline-flex items-center ' +
                    (className ?? 'cursor-help underline decoration-dotted underline-offset-2')
                }
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onClick={(e) => {
                    // tap/click toggle (mobile)
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
                tabIndex={0}
                role="button"
                aria-label={`Description: ${label}`}
            >
                {label}
            </span>

            {open && pos && (
                <Portal>
                    <div
                        style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.maxWidth, zIndex: 1000 }}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 shadow-xl"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <div className="block font-semibold">{label}</div>
                        <div className="mt-1 block whitespace-pre-wrap text-zinc-300">{desc}</div>
                    </div>
                </Portal>
            )}
        </>
    );
}

export function usePreloadEffects(effectIds: string[]) {
    const ids = useMemo(() => Array.from(new Set(effectIds)).filter(Boolean), [effectIds]);
    useEffect(() => {
        if (ids.length === 0) return;
        void fetchEffects(ids);
    }, [ids]);
}
