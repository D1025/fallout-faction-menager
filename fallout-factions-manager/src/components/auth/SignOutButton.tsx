'use client';

import { LogoutOutlined } from '@ant-design/icons';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
    return (
        <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs active:scale-[0.98]"
            title="Wyloguj"
        >
            <LogoutOutlined className="mr-1 text-zinc-200" /> Wyloguj
        </button>
    );
}
