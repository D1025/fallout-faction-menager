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
    // This view has been replaced by the "Resources" section on the army page.
    redirect(`/army/${armyId}`);
}
