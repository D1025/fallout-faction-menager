import type { ReactNode } from 'react';
import { Layout } from 'antd';
import { AppHeader } from '@/components/nav/AppHeader';

export function MobilePageShell({
  title,
  backHref,
  headerRight,
  children,
  stickyActions,
}: {
  title: string;
  backHref?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  stickyActions?: ReactNode;
}) {
  const maxWidth = 430;

  return (
    <Layout style={{ minHeight: '100dvh' }}>
      <AppHeader title={title} backHref={backHref} right={headerRight} />
      <Layout.Content style={{ padding: '12px 12px calc(env(safe-area-inset-bottom) + 104px)' }}>
        <div style={{ maxWidth, margin: '0 auto', width: '100%' }}>{children}</div>
      </Layout.Content>
      {stickyActions ? (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 20,
            padding: '10px 12px calc(env(safe-area-inset-bottom) + 12px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(8px)',
            background: 'rgba(15,17,21,0.92)',
          }}
        >
          <div style={{ maxWidth, margin: '0 auto', width: '100%' }}>{stickyActions}</div>
        </div>
      ) : null}
    </Layout>
  );
}
