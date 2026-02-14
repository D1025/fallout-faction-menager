'use client';

import { Avatar, Button, Dropdown, type MenuProps } from 'antd';
import { LogoutOutlined, ToolOutlined, UserOutlined } from '@ant-design/icons';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { confirmAction } from '@/lib/ui/notify';

export function UserAccountMenu({
    name,
    role,
    photoEtag,
}: {
    name: string;
    role: 'USER' | 'ADMIN';
    photoEtag?: string | null;
}) {
    const router = useRouter();

    const items: MenuProps['items'] = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Profil',
        },
        role === 'ADMIN'
            ? {
                  key: 'admin',
                  icon: <ToolOutlined />,
                  label: 'Administrator',
              }
            : null,
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Wyloguj',
            danger: true,
        },
    ];

    const src = photoEtag ? `/api/profile/photo/file?v=${photoEtag}` : undefined;
    const fallbackInitial = name.trim().charAt(0).toUpperCase() || 'U';

    const onSelect: NonNullable<MenuProps['onClick']> = ({ key }) => {
        const selected = String(key);
        if (selected === 'profile') {
            router.push('/profile');
            return;
        }
        if (selected === 'admin') {
            router.push('/admin');
            return;
        }
        if (selected === 'logout') {
            confirmAction({
                title: 'Potwierdz wylogowanie',
                content: 'Czy na pewno chcesz sie wylogowac?',
                okText: 'Wyloguj',
                cancelText: 'Anuluj',
                danger: true,
                onOk: async () => {
                    await signOut({ callbackUrl: '/login' });
                },
            });
        }
    };

    return (
        <Dropdown menu={{ items, onClick: onSelect }} trigger={['click']} placement="bottomRight">
            <Button
                type="default"
                aria-label="Menu konta"
                title="Menu konta"
                className="ff-ant-btn-icon-mobile ff-account-trigger"
                icon={
                    <Avatar
                        size={28}
                        src={src}
                        icon={!src ? <UserOutlined /> : undefined}
                        alt={name}
                    >
                        {!src ? fallbackInitial : null}
                    </Avatar>
                }
            >
                {name}
            </Button>
        </Dropdown>
    );
}
