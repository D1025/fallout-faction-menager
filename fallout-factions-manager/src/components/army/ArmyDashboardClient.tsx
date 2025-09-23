'use client';

export function ArmyDashboardClient(props: {
    armyId: string;
    armyName: string;
    factionName: string;
    tier: number;
    rating: number;
    limits: { tag: string; tier1?: number|null; tier2?: number|null; tier3?: number|null }[];
    resources: { caps: number; parts: number; reach: number };
    unitsCount: number;
}) {
    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-3">
                    <div className="text-base font-semibold">{props.armyName}</div>
                    <div className="text-xs text-zinc-400">{props.factionName} • T{props.tier}</div>
                </div>
            </header>

            <main className="mx-auto max-w-screen-sm px-3 pb-20">
                <div className="mt-3 grid grid-cols-3 gap-2">
                    <StatCard label="Rating" value={props.rating} />
                    <StatCard label="Jednostki" value={props.unitsCount} />
                    <StatCard label="Tier" value={props.tier} />
                </div>

                <section className="mt-4 grid grid-cols-3 gap-2">
                    <ResCard label="Caps" value={props.resources.caps} href={`/army/${props.armyId}/resources`} />
                    <ResCard label="Parts" value={props.resources.parts} href={`/army/${props.armyId}/resources`} />
                    <ResCard label="Reach" value={props.resources.reach} href={`/army/${props.armyId}/resources`} />
                </section>

                <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="text-sm font-medium mb-2">Limity frakcji</div>
                    <div className="flex flex-wrap gap-1.5">
                        {props.limits.map(l => (
                            <span key={l.tag} className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px]">
                <span className="font-medium">{l.tag}</span>
                <span className="text-zinc-400">{[l.tier1??'–', l.tier2??'–', l.tier3??'–'].join('/')}</span>
              </span>
                        ))}
                    </div>
                </section>

                <nav className="mt-5 grid grid-cols-2 gap-2">
                    <NavBtn href={`/army/${props.armyId}/roster`} label="Roster" />
                    <NavBtn href={`/army/${props.armyId}/resources`} label="Zasoby" />
                </nav>
            </main>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: number|string }) {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-center">
            <div className="text-xs text-zinc-400">{label}</div>
            <div className="text-lg font-semibold">{value}</div>
        </div>
    );
}
function ResCard({ label, value, href }: { label: string; value: number; href: string }) {
    return (
        <a href={href} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-center active:scale-[0.99]">
            <div className="text-xs text-zinc-400">{label}</div>
            <div className="text-lg font-semibold">{value}</div>
        </a>
    );
}
function NavBtn({ href, label }: { href: string; label: string }) {
    return (
        <a href={href} className="h-12 rounded-2xl border border-zinc-800 bg-zinc-900 grid place-items-center text-sm font-medium active:scale-[0.99]">
            {label}
        </a>
    );
}
