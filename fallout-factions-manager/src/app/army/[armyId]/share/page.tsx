export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { UserAccountMenu } from '@/components/auth/UserAccountMenu';
import { ArmyShareClient } from '@/components/army/ArmyShareClient';
import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';

export default async function Page({ params }: { params: Promise<{ armyId: string }> }) {
    const { armyId } = await params;
    const session = await auth();
    const userId = session?.user?.id ?? null;
    if (!userId) {
        return (
            <MobilePageShell title="Share Army" backHref="/login">
                <section className="vault-panel mt-3 p-4 text-sm text-red-300">Unauthorized</section>
            </MobilePageShell>
        );
    }

    const [userMeta, army] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, role: true, photoEtag: true },
        }),
        prisma.army.findUnique({
            where: { id: armyId },
            select: { id: true, name: true, ownerId: true },
        }),
    ]);

    if (!army) {
        return (
            <MobilePageShell title="Share Army" backHref="/">
                <section className="vault-panel mt-3 p-4 text-sm text-red-300">Army not found.</section>
            </MobilePageShell>
        );
    }

    if (army.ownerId !== userId) {
        return (
            <MobilePageShell title="Share Army" backHref={`/army/${armyId}`}>
                <section className="vault-panel mt-3 p-4 text-sm text-red-300">
                    Only the owner can manage public sharing.
                </section>
            </MobilePageShell>
        );
    }

    const headerRight = userMeta ? (
        <UserAccountMenu
            name={userMeta.name}
            role={userMeta.role as 'USER' | 'ADMIN'}
            photoEtag={userMeta.photoEtag ?? null}
        />
    ) : undefined;

    return (
        <MobilePageShell title="Share Army" backHref={`/army/${armyId}`} headerRight={headerRight}>
            <ArmyShareClient armyId={army.id} armyName={army.name} />
        </MobilePageShell>
    );
}

