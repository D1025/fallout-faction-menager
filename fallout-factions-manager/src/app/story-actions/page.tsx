import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { StoryActionsClient } from '@/components/story-actions/StoryActionsClient';

export default function StoryActionsPage() {
    return (
        <MobilePageShell title="Story Actions" backHref="/">
            <StoryActionsClient />
        </MobilePageShell>
    );
}

