'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-dvh grid place-items-center">Ładowanie…</div>}>
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
        <div className="min-h-dvh grid place-items-center px-4">
            <div className="vault-panel w-full max-w-sm p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Fallout Factions</p>
                <h1 className="mt-2 text-xl font-semibold">🎮 Panel dowódcy</h1>
                <p className="mt-1 text-sm vault-muted">Wpisz nick, aby uruchomić tracker armii na telefonie.</p>
                <form onSubmit={submit} className="mt-5 grid gap-3">
                    <label className="grid gap-1.5">
                        <span className="text-xs vault-muted">Nick gracza</span>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="np. Overseer"
                            className="h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-emerald-400"
                        />
                    </label>
                    <button
                        disabled={name.trim().length < 2}
                        className="h-11 rounded-xl bg-emerald-500 text-sm font-semibold text-emerald-950 disabled:opacity-40"
                    >
                        🔐 Wejdź do aplikacji
                    </button>
                </form>
            </div>
        </div>
    );
}
