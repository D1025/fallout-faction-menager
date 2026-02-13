'use client';

export function QuickToggle({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={
                'h-10 rounded-xl border px-3 text-xs font-medium ' +
                (checked
                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-300')
            }
        >
            {label}
        </button>
    );
}
