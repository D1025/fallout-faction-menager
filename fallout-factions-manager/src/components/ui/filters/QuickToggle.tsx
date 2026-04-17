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
                'h-10 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-xl px-3 text-xs font-medium ' +
                (checked
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'bg-zinc-900 text-zinc-300')
            }
            title={label}
        >
            {label}
        </button>
    );
}
