export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { UserAccountMenu } from '@/components/auth/UserAccountMenu';
import { RuleHintList } from '@/components/share/RuleHintList';
import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { getPublicArmySnapshotByToken } from '@/lib/army/publicShare';

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

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const userMeta = userId
        ? await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, role: true, photoEtag: true },
        })
        : null;

    const snapshot = await getPublicArmySnapshotByToken({ token, viewerUserId: userId });
    if (!snapshot) {
        return (
            <MobilePageShell title="Shared army" backHref="/">
                <section className="vault-panel mt-3 p-4">
                    <div className="text-base font-semibold text-red-300">Share link is invalid or disabled.</div>
                </section>
            </MobilePageShell>
        );
    }

    const headerRight =
        userMeta != null ? (
            <UserAccountMenu
                name={userMeta.name}
                role={userMeta.role as 'USER' | 'ADMIN'}
                photoEtag={userMeta.photoEtag ?? null}
            />
        ) : undefined;

    return (
        <MobilePageShell title={snapshot.army.name} backHref="/" headerRight={headerRight}>
            <main className="space-y-3 pt-3">
                <section className="vault-panel p-3">
                    <div className="text-sm font-medium">
                        {snapshot.army.faction.name}
                        {snapshot.army.subfactionName ? ` | ${snapshot.army.subfactionName}` : ''}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                        Tier {snapshot.army.tier} | Rating {snapshot.army.rating}
                    </div>
                    <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-300">
                        Read-only shared view
                    </div>
                </section>

                <section className="vault-panel p-3">
                    <div className="text-sm font-medium">Resources</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs sm:grid-cols-5">
                        {(
                            [
                                ['CAPS', snapshot.army.resources.caps],
                                ['PARTS', snapshot.army.resources.parts],
                                ['SCOUT', snapshot.army.resources.scout],
                                ['REACH', snapshot.army.resources.reach],
                                ['XP', snapshot.army.resources.exp],
                            ] as const
                        ).map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                                <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
                                <div className="mt-1 text-base font-semibold text-zinc-100">{value}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="vault-panel p-3">
                    <div className="text-sm font-medium">Home Turf</div>
                    <div className="mt-2 text-xs text-zinc-300">
                        Hazard:{' '}
                        <span className="font-semibold text-zinc-100">
                            {snapshot.army.homeTurf.hazard?.name ?? 'None'}
                        </span>
                    </div>
                    {snapshot.army.homeTurf.hazard?.description ? (
                        <div className="mt-1 whitespace-pre-wrap text-xs text-zinc-400">
                            {snapshot.army.homeTurf.hazard.description}
                        </div>
                    ) : null}
                    {snapshot.army.homeTurf.facilities.length > 0 ? (
                        <div className="mt-2 grid gap-2">
                            {snapshot.army.homeTurf.facilities.map((f) => (
                                <div key={f.name} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                                    <div className="text-xs font-semibold text-zinc-100">{f.name}</div>
                                    <div className="mt-1 whitespace-pre-wrap text-xs text-zinc-400">{f.description || '-'}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-1 text-xs text-zinc-500">No facilities selected.</div>
                    )}
                </section>

                <section className="vault-panel p-3">
                    <div className="text-sm font-medium">Units ({snapshot.units.length})</div>
                    <div className="mt-2 grid gap-2">
                        {snapshot.units.map((u) => (
                            <div key={u.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="truncate font-medium text-zinc-100">{u.name}</div>
                                        <div className="mt-0.5 text-[11px] text-zinc-400">
                                            {u.roleTag ?? 'GRUNT'} | Rating {u.rating}
                                            {!u.present ? ' | Absent' : ''}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-2 overflow-hidden rounded-xl border border-zinc-800">
                                    <table className="w-full table-fixed text-xs">
                                        <thead>
                                            <tr className="bg-teal-700/70 text-teal-50">
                                                {(['S', 'P', 'E', 'C', 'I', 'A', 'L', 'HP'] as const).map((k) => (
                                                    <th key={k} className="px-1 py-1 text-center">{k}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="bg-zinc-950 text-zinc-100">
                                                <td className="px-1 py-1 text-center">{u.special.S}</td>
                                                <td className="px-1 py-1 text-center">{u.special.P}</td>
                                                <td className="px-1 py-1 text-center">{u.special.E}</td>
                                                <td className="px-1 py-1 text-center">{u.special.C}</td>
                                                <td className="px-1 py-1 text-center">{u.special.I}</td>
                                                <td className="px-1 py-1 text-center">{u.special.A}</td>
                                                <td className="px-1 py-1 text-center">{u.special.L}</td>
                                                <td className="px-1 py-1 text-center">{u.special.HP}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-2 grid gap-2">
                                    {u.weapons.map((w, idx) => {
                                        const typeParts = splitTypeAndRange(w.type);
                                        const isMeleeWeapon = typeParts.type.toLowerCase().includes('melee');
                                        return (
                                            <div key={`${u.id}_${idx}`} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                                                <div className="flex items-center gap-2 border-b border-zinc-800 px-2 py-1.5">
                                                    <div className="text-xs font-medium text-zinc-100 sm:text-sm">{w.name}</div>
                                                    <div className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">
                                                        {typeParts.type}
                                                    </div>
                                                </div>
                                                <div className={isMeleeWeapon ? 'max-w-full overflow-x-hidden' : 'vault-scrollbar max-w-full overflow-x-auto'}>
                                                    <table className="w-full table-fixed text-[10px] leading-tight sm:text-xs">
                                                        <thead>
                                                            <tr className="bg-teal-700/70 text-[11px] font-semibold uppercase tracking-wide text-teal-50">
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
                                                            <tr className="border-t border-zinc-800 align-top bg-zinc-950">
                                                                {!isMeleeWeapon ? (
                                                                    <td className="px-1 py-1 whitespace-normal break-all text-zinc-100">{typeParts.range || '-'}</td>
                                                                ) : null}
                                                                <td className="px-1 py-1 whitespace-normal break-all text-zinc-100">{w.test || '-'}</td>
                                                                <td className="px-1 py-1 whitespace-normal break-all text-zinc-300">
                                                                    <RuleHintList items={w.traits} />
                                                                </td>
                                                                <td className="px-1 py-1 whitespace-normal break-all text-zinc-300">
                                                                    <RuleHintList items={w.criticals} />
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {u.weapons.length === 0 ? (
                                        <div className="text-xs text-zinc-500">No weapon data.</div>
                                    ) : null}
                                </div>

                                <div className="mt-3 grid gap-2">
                                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-teal-50">Perks</div>
                                        <div className="mt-1 text-xs text-zinc-300">
                                            <RuleHintList
                                                items={u.perks.map((p) => ({
                                                    label: p.name,
                                                    description: p.description,
                                                }))}
                                                emptyText="No perks."
                                            />
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-teal-50">Upgrades</div>
                                        <div className="mt-1 flex flex-wrap gap-1 text-xs text-zinc-200">
                                            {u.upgrades.length === 0 ? (
                                                <span className="text-zinc-500">No upgrades.</span>
                                            ) : (
                                                u.upgrades.map((up, idx) => (
                                                    <span
                                                        key={`${u.id}_up_${up.statKey}_${idx}`}
                                                        className={
                                                            'inline-flex rounded-md border px-1.5 py-0.5 font-medium ' +
                                                            (up.delta > 0
                                                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                                                                : 'border-red-500/40 bg-red-500/10 text-red-200')
                                                        }
                                                    >
                                                        {up.delta > 0 ? `+${up.delta}` : up.delta} {up.statKey}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </MobilePageShell>
    );
}
