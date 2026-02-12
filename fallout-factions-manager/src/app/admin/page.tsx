export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { auth } from '@/lib/authServer';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { EntityListItem } from '@/components/ui/antd/EntityListItem';
import { SectionCard } from '@/components/ui/antd/SectionCard';

const links = [
    { href: '/admin/factions', label: 'Frakcje', icon: '🏴' },
    { href: '/admin/subfactions', label: 'Subfrakcje', icon: '🧩' },
    { href: '/admin/templates', label: 'Szablony jednostek', icon: '📋' },
    { href: '/admin/perks', label: 'Perki', icon: '✨' },
    { href: '/admin/weapons', label: 'Broń i zestawy', icon: '🔫' },
    { href: '/admin/effects', label: 'Efekty broni', icon: '💥' },
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
                    <EntityListItem key={x.href} href={x.href} title={<span>{x.icon} {x.label}</span>} />
                ))}
            </div>
        </MobilePageShell>
    );
}
