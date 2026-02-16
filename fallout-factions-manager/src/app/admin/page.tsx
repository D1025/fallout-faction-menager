export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { AppstoreOutlined, DatabaseOutlined, DeploymentUnitOutlined, SettingOutlined, ToolOutlined } from '@ant-design/icons';
import { auth } from '@/lib/authServer';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { EntityListItem } from '@/components/ui/antd/EntityListItem';
import { SectionCard } from '@/components/ui/antd/SectionCard';

const links = [
    { href: '/admin/factions', label: 'Factions', icon: <SettingOutlined className="text-zinc-200" /> },
    { href: '/admin/subfactions', label: 'Subfactions', icon: <AppstoreOutlined className="text-zinc-200" /> },
    { href: '/admin/home-turf', label: 'Home Turf rules', icon: <SettingOutlined className="text-zinc-200" /> },
    { href: '/admin/templates', label: 'Unit templates', icon: <DeploymentUnitOutlined className="text-zinc-200" /> },
    { href: '/admin/perks', label: 'Perks', icon: <ToolOutlined className="text-zinc-200" /> },
    { href: '/admin/weapons', label: 'Weapons and loadouts', icon: <DatabaseOutlined className="text-zinc-200" /> },
    { href: '/admin/effects', label: 'Weapon effects', icon: <SettingOutlined className="text-zinc-200" /> },
];

export default async function AdminHome() {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return <div className="p-4 text-red-300">Access denied.</div>;

    return (
        <MobilePageShell title="Admin panel" backHref="/">
            <SectionCard>
                <p className="text-sm vault-muted">Manage dictionaries and army rule configuration. Optimized for mobile screens.</p>
            </SectionCard>
            <div className="mt-3 grid gap-2">
                {links.map((x) => (
                    <EntityListItem key={x.href} href={x.href} title={<span className="inline-flex items-center gap-2">{x.icon} {x.label}</span>} />
                ))}
            </div>
        </MobilePageShell>
    );
}
