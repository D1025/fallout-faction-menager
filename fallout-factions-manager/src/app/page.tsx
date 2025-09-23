export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { SignOutButton } from '@/components/auth/SignOutButton';

export default async function Home() {
  const session = await auth();
  const userId = session?.user?.id;
  const isAdmin = session?.user.role === 'ADMIN';

  // Gdyby middleware był wyłączony i user nie był zalogowany:
  if (!userId) {
    return (
        <div className="min-h-dvh grid place-items-center bg-zinc-950 text-zinc-100 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-5 text-center">
            <div className="text-lg font-semibold">Wymagane logowanie</div>
            <p className="mt-2 text-sm text-zinc-400">Przejdź do strony logowania.</p>
            <Link
                href="/login"
                className="mt-4 inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 active:scale-[0.99]"
            >
              Zaloguj
            </Link>
          </div>
        </div>
    );
  }

  let myArmies:
      | { id: string; name: string; tier: number }[]
      | []
      , shared:
      | { id: string; perm: 'READ' | 'WRITE'; army: { id: string; name: string; tier: number } }[]
      | [] = [];

  try {
    [myArmies, shared] = await Promise.all([
      prisma.army.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, tier: true },
      }),
      prisma.armyShare.findMany({
        where: { userId },
        include: { army: { select: { id: true, name: true, tier: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
  } catch {
    myArmies = [];
    shared = [];
  }

  return (
      <div className="min-h-dvh bg-zinc-950 text-zinc-100">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-3">
            <div className="text-base font-semibold">Twoje drużyny</div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                  <Link
                      href="/admin"
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs"
                  >
                    Admin
                  </Link>
              )}
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-screen-sm px-3 pb-24">
          {/* Moje drużyny */}
          <section className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">Moje drużyny</div>
              <Link
                  href="/army/new"
                  className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 active:scale-[0.99]"
              >
                Dodaj nową
              </Link>
            </div>
            <div className="grid gap-2">
              {myArmies.map((a) => (
                  <Link
                      key={a.id}
                      href={`/army/${a.id}`}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-zinc-400">T{a.tier}</div>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">tap, aby zarządzać</div>
                  </Link>
              ))}
              {myArmies.length === 0 && (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
                    Nie masz jeszcze drużyn. Kliknij „Dodaj nową”.
                  </div>
              )}
            </div>
          </section>

          {/* Udostępnione dla mnie */}
          <section className="mt-5">
            <div className="mb-2 text-sm font-medium">Udostępnione dla mnie</div>
            <div className="grid gap-2">
              {shared.map((s) => (
                  <Link
                      key={s.id}
                      href={`/army/${s.army.id}`}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{s.army.name}</div>
                      <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px]">
                    {s.perm === 'READ' ? 'tylko odczyt' : 'współpraca'}
                  </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">T{s.army.tier}</div>
                  </Link>
              ))}
              {shared.length === 0 && (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
                    Nikt jeszcze nic Ci nie udostępnił.
                  </div>
              )}
            </div>
          </section>
        </main>
      </div>
  );
}
