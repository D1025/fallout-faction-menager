'use client';

import { LogoutOutlined } from '@ant-design/icons';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
    return (
        <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="ff-btn ff-btn-icon-mobile"
            title="Wyloguj"
            aria-label="Wyloguj"
        >
            <LogoutOutlined className="ff-btn-icon" />
            <span className="ff-btn-label">Wyloguj</span>
        </button>
    );
}
