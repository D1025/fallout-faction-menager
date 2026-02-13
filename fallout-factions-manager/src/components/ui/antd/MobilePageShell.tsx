'use client';

import type { ReactNode } from 'react';
import { Grid, Layout } from 'antd';
import Content from 'antd/es/layout/layout';
import { AppHeader } from '@/components/nav/AppHeader';

const SAFE_AREA_VAR = '--safe-area-inset-bottom';

export function MobilePageShell({
  title,
  backHref,
  headerRight,
  children,
  stickyActions,
  desktopSidebar,
}: {
  title: string;
  backHref?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  stickyActions?: ReactNode;
  desktopSidebar?: ReactNode;
}) {
  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.lg);
  const contentMaxWidth = isDesktop ? 1200 : 560;

  return (
    <Layout
      style={{
        minHeight: '100dvh',
        [SAFE_AREA_VAR]: 'env(safe-area-inset-bottom, 0px)',
        ['--safe-area-inset-bottom-legacy']: 'constant(safe-area-inset-bottom, 0px)',
      } as React.CSSProperties}
    >
      <AppHeader title={title} backHref={backHref} right={headerRight} maxWidth={contentMaxWidth} />
      <Content
        style={{
          padding: isDesktop
            ? '20px 24px 20px'
            : '12px 12px calc(var(--safe-area-inset-bottom, 0px) + 96px)',
        }}
      >
        <div
          style={{
            maxWidth: contentMaxWidth,
            margin: '0 auto',
            width: '100%',
            display: 'grid',
            gridTemplateColumns: isDesktop && desktopSidebar ? 'minmax(240px, 300px) minmax(0, 1fr)' : 'minmax(0, 1fr)',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {isDesktop && desktopSidebar ? (
            <aside style={{ position: 'sticky', top: 72, maxHeight: 'calc(100dvh - 88px)', overflowY: 'auto' }}>
              {desktopSidebar}
            </aside>
          ) : null}
          <main>{children}</main>
        </div>
      </Content>
      {stickyActions ? (
        <div
          style={{
            position: isDesktop ? 'sticky' : 'sticky',
            bottom: 0,
            zIndex: 20,
            padding: isDesktop
              ? '10px 24px 10px'
              : '10px 12px calc(var(--safe-area-inset-bottom, 0px) + 10px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(8px)',
            background: 'rgba(15,17,21,0.92)',
          }}
        >
          <div style={{ maxWidth: contentMaxWidth, margin: '0 auto', width: '100%' }}>{stickyActions}</div>
        </div>
      ) : null}
    </Layout>
  );
}
