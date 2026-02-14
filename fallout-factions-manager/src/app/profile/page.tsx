export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { SectionCard } from '@/components/ui/antd/SectionCard';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';

export default async function ProfilePage() {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) redirect('/login?next=/profile');

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            name: true,
            role: true,
            photoEtag: true,
        },
    });
    if (!user) redirect('/login?next=/profile');

    return (
        <MobilePageShell title="Profil" backHref="/">
            <SectionCard>
                <div className="mb-3">
                    <p className="ff-panel-headline">Commander Profile</p>
                    <h2 className="ff-panel-title">Twoje konto</h2>
                </div>
                <ProfileEditor initialName={user.name} role={user.role} initialPhotoEtag={user.photoEtag} />
            </SectionCard>
        </MobilePageShell>
    );
}

