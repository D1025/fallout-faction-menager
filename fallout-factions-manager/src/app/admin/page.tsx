export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { auth } from '@/lib/authServer';
import { AppHeader } from '@/components/nav/AppHeader';

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
        <div className="min-h-dvh">
            <AppHeader title="Panel admina" backHref="/" />

            <main className="app-shell pt-4">
                <section className="vault-panel p-3 text-sm vault-muted">Zarządzaj słownikami i konfiguracją zasad armii. Widok zoptymalizowany pod smartfony.</section>
                <div className="mt-3 grid gap-2">
                    {links.map((x) => (
                        <Link key={x.href} href={x.href} className="vault-panel flex items-center gap-3 p-3 text-sm font-medium active:scale-[0.99]">
                            <span>{x.icon}</span>
                            <span>{x.label}</span>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    );
}
