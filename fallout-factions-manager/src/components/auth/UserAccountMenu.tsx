'use client';

import { Avatar, Button, Dropdown, type MenuProps } from 'antd';
import { LogoutOutlined, ToolOutlined, UserOutlined } from '@ant-design/icons';
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
            label: 'Profile',
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
            label: 'Sign out',
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
                title: 'Confirm sign out',
                content: 'Are you sure you want to sign out?',
                okText: 'Sign out',
                cancelText: 'Cancel',
                danger: true,
                onOk: async () => {
                    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
                    router.push('/login');
                    router.refresh();
                },
            });
        }
    };

    return (
        <Dropdown menu={{ items, onClick: onSelect }} trigger={['click']} placement="bottomRight">
            <Button
                type="default"
                aria-label="Account menu"
                title="Account menu"
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
