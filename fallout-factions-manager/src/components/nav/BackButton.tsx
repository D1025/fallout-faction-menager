'use client';

import { useRouter } from 'next/navigation';

export function BackButton({
    fallbackHref,
    label = 'Wróć',
    className = 'text-sm text-zinc-300',
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
        <button type="button" onClick={goBack} className={className} aria-label={label} title={label}>
            ← {label}
        </button>
    );
}
