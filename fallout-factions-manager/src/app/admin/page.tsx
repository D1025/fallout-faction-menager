export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { AppstoreOutlined, DatabaseOutlined, DeploymentUnitOutlined, SettingOutlined, ToolOutlined } from '@ant-design/icons';
import { auth } from '@/lib/authServer';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { EntityListItem } from '@/components/ui/antd/EntityListItem';
import { SectionCard } from '@/components/ui/antd/SectionCard';

const links = [
    { href: '/admin/factions', label: 'Frakcje', icon: <SettingOutlined className="text-zinc-200" /> },
    { href: '/admin/subfactions', label: 'Subfrakcje', icon: <AppstoreOutlined className="text-zinc-200" /> },
    { href: '/admin/templates', label: 'Szablony jednostek', icon: <DeploymentUnitOutlined className="text-zinc-200" /> },
    { href: '/admin/perks', label: 'Perki', icon: <ToolOutlined className="text-zinc-200" /> },
    { href: '/admin/weapons', label: 'Broń i zestawy', icon: <DatabaseOutlined className="text-zinc-200" /> },
    { href: '/admin/effects', label: 'Efekty broni', icon: <SettingOutlined className="text-zinc-200" /> },
];

export default async function AdminHome() {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return <div className="p-4 text-red-300">Brak uprawnień.</div>;

    return (
        <MobilePageShell title="Panel admina" backHref="/">
            <SectionCard>
                <p className="text-sm vault-muted">Zarządzaj słownikami i konfiguracją zasad armii. Widok zoptymalizowany pod smartfony.</p>
            </SectionCard>
            <div className="mt-3 grid gap-2">
                {links.map((x) => (
                    <EntityListItem key={x.href} href={x.href} title={<span className="inline-flex items-center gap-2">{x.icon} {x.label}</span>} />
                ))}
            </div>
        </MobilePageShell>
    );
}
