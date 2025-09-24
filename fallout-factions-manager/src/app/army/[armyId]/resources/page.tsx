// src/app/army/[armyId]/resources/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';

export default async function Page({
                                       params,
                                   }: {
    params: Promise<{ armyId: string }>;
}) {
    const { armyId } = await params;
    // Ten widok został zastąpiony przez sekcję "Zasoby" na stronie armii.
    redirect(`/army/${armyId}`);
}
