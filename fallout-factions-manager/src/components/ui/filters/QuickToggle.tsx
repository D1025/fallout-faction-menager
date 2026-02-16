'use client';

export function QuickToggle({
    checked,
    onChangeAction,
    label,
}: {
    checked: boolean;
    onChangeAction: (next: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={() => onChangeAction(!checked)}
            className={
                'h-10 min-w-0 rounded-xl border px-3 text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis ' +
                (checked
                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-300')
            }
            title={label}
        >
            {label}
        </button>
    );
}
