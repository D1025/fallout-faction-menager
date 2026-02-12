'use client';

import { useRouter } from 'next/navigation';

export function BackButton({
    fallbackHref,
    label = 'Wróć',
    className,
}: {
    fallbackHref: string;
    label?: string;
    className?: string;
}) {
    const router = useRouter();

    function goBack() {
        if (typeof document !== 'undefined' && document.referrer) {
            router.back();
        } else {
            router.push(fallbackHref);
        }
    }

    return (
        <button
            type="button"
            onClick={goBack}
            className={className ?? 'inline-flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100'}
            aria-label={label}
            title={label}
        >
            <span aria-hidden>◀</span>
            <span>{label}</span>
        </button>
    );
}
