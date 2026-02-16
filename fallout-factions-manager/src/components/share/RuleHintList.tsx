'use client';

import { useEffect, useRef, useState } from 'react';
import { Portal } from '@/components/ui/Portal';
import { RuleDescription } from '@/components/rules/RuleDescription';

type PopPos = { top: number; left: number; maxWidth: number };

export type RuleHintItem = {
    label: string;
    description: string;
};

function RuleHint({ item }: { item: RuleHintItem }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<PopPos | null>(null);
    const rootRef = useRef<HTMLButtonElement | null>(null);
    const popRef = useRef<HTMLDivElement | null>(null);

    function computePos() {
        const el = rootRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const margin = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const maxWidth = Math.min(460, Math.max(240, Math.floor(vw * 0.92)));

        let left = r.left + r.width / 2 - maxWidth / 2;
        left = Math.max(margin, Math.min(left, vw - maxWidth - margin));

        const desiredHeight = 240;
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
            if (popRef.current?.contains(t)) return;
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
            <button
                ref={rootRef}
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
                className="cursor-help text-left underline decoration-dotted underline-offset-2"
                aria-label={`Show rule description: ${item.label}`}
            >
                {item.label}
            </button>
            {open && pos ? (
                <Portal>
                    <div
                        ref={popRef}
                        style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.maxWidth, zIndex: 1000 }}
                        className="max-h-[70dvh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 shadow-xl vault-scrollbar"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <div className="mb-2 text-sm font-semibold text-zinc-100">{item.label}</div>
                        <RuleDescription text={(item.description ?? '').trim() || 'No description.'} />
                    </div>
                </Portal>
            ) : null}
        </>
    );
}

export function RuleHintList({
    items,
    emptyText = '-',
}: {
    items: RuleHintItem[];
    emptyText?: string;
}) {
    if (!items.length) return <span className="text-zinc-500">{emptyText}</span>;
    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {items.map((item) => (
                <RuleHint key={`${item.label}::${item.description}`} item={item} />
            ))}
        </div>
    );
}
