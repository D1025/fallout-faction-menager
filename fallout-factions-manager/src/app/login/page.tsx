'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-dvh grid place-items-center bg-zinc-950 text-zinc-100">Ładowanie…</div>}>
            <LoginForm />
        </Suspense>
    );
}

function LoginForm() {
    const [name, setName] = useState('');
    const router = useRouter();
    const sp = useSearchParams();
    const next = sp.get('next') || '/';

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const res = await signIn('credentials', { name, redirect: false });
        if (res?.ok) router.push(next);
        else alert('Logowanie nieudane');
    }

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100 grid place-items-center px-4">
            <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="text-lg font-semibold">Zaloguj się</div>
                <p className="mt-1 text-sm text-zinc-400">Podaj nick, żeby wejść.</p>
                <form onSubmit={submit} className="mt-4 grid gap-3">
                    <label className="grid gap-1">
                        <span className="text-xs text-zinc-400">Nick</span>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="np. Overseer"
                            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                        />
                    </label>
                    <button
                        disabled={name.trim().length < 2}
                        className="h-11 rounded-2xl bg-emerald-500 text-emerald-950 font-semibold disabled:opacity-40 active:scale-[0.99]"
                    >
                        Wejdź
                    </button>
                </form>
            </div>
        </div>
    );
}
