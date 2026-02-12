import type { ReactNode } from 'react';
import { Layout } from 'antd';
import Content from 'antd/es/layout/layout';
import { AppHeader } from '@/components/nav/AppHeader';

const SAFE_AREA_VAR = '--safe-area-inset-bottom';

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
  return (
    <Layout
      style={{
        minHeight: '100dvh',
        [SAFE_AREA_VAR]: 'env(safe-area-inset-bottom, 0px)',
        ['--safe-area-inset-bottom-legacy']: 'constant(safe-area-inset-bottom, 0px)',
      } as React.CSSProperties}
    >
      <AppHeader title={title} backHref={backHref} right={headerRight} />
      <Content
        style={{
          padding:
            '12px 12px calc(var(--safe-area-inset-bottom, 0px) + 96px)',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>{children}</div>
      </Content>
      {stickyActions ? (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 20,
            padding: '10px 12px calc(var(--safe-area-inset-bottom, 0px) + 10px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(8px)',
            background: 'rgba(15,17,21,0.92)',
          }}
        >
          <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>{stickyActions}</div>
        </div>
      ) : null}
    </Layout>
  );
}
