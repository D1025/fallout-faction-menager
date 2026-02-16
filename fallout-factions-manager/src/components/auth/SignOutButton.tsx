'use client';

import { LogoutOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

export function SignOutButton() {
    const router = useRouter();

    return (
        <button
            onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
                router.push('/login');
                router.refresh();
            }}
            className="ff-btn ff-btn-icon-mobile"
            title="Wyloguj"
            aria-label="Wyloguj"
        >
            <LogoutOutlined className="ff-btn-icon" />
            <span className="ff-btn-label">Wyloguj</span>
        </button>
    );
}
