'use client';

export function RosterClient(props: {
    armyId: string;
    armyName: string;
    units: { id: string; name: string; wounds: number; present: boolean; weaponsCount: number; upgradesCount: number; photoPath: string|null }[];
}) {
    return (
        <div className="min-h-dvh">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0d1117]/95 backdrop-blur">
                <div className="mx-auto flex h-14 w-full max-w-[560px] items-center justify-between px-3">
                    <a href={`/army/${props.armyId}`} className="text-sm text-zinc-300">←</a>
                    <div className="text-base font-semibold">Roster: {props.armyName}</div>
                    <span className="w-6" />
                </div>
            </header>

            <main className="app-shell">
                <div className="mt-3 grid gap-2">
                    {props.units.map(u => (
                        <a key={u.id} href={`/army/${props.armyId}/unit/${u.id}`} className="flex items-center gap-3 vault-panel p-3 active:scale-[0.99]">
                            <div className="h-12 w-12 rounded-xl bg-zinc-800 grid place-items-center text-zinc-300">{u.photoPath ? '🖼️' : u.name.slice(0,2)}</div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium">{u.name}</div>
                                    <div className="text-xs text-zinc-400">{u.present ? 'obecny' : 'rezerwa'}</div>
                                </div>
                                <div className="text-xs text-zinc-400">Rany: {u.wounds}/4 • Broń: {u.weaponsCount} • Ulepszenia: {u.upgradesCount}</div>
                            </div>
                        </a>
                    ))}
                </div>

                <a href={`/army/${props.armyId}/roster/add`} className="fixed bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-2xl text-emerald-950 shadow-lg active:scale-95">＋</a>
            </main>
        </div>
    );
}
