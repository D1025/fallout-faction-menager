export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
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
        <MobilePageShell title="Profile" backHref="/">
            <main className="mx-auto max-w-screen-sm overflow-x-hidden px-3 pb-24">
                <div className="mt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-100">Commander Profile</div>
                    <div className="mt-1 text-sm text-zinc-300">Manage your account and credentials.</div>
                </div>
                <ProfileEditor initialName={user.name} role={user.role} initialPhotoEtag={user.photoEtag} />
            </main>
        </MobilePageShell>
    );
}

