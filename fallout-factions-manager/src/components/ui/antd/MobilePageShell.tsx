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
      className="ff-shell"
      style={{
        [SAFE_AREA_VAR]: 'env(safe-area-inset-bottom, 0px)',
        ['--safe-area-inset-bottom-legacy']: 'constant(safe-area-inset-bottom, 0px)',
      } as React.CSSProperties}
    >
      <AppHeader title={title} backHref={backHref} right={headerRight} maxWidth={contentMaxWidth} />
      <Content
        className="ff-shell-content"
        style={{
          padding: isDesktop ? '20px 24px 24px' : undefined,
        }}
      >
        <div
          className="ff-shell-grid"
          style={{
            maxWidth: contentMaxWidth,
            gridTemplateColumns: isDesktop && desktopSidebar ? 'minmax(240px, 300px) minmax(0, 1fr)' : 'minmax(0, 1fr)',
          }}
        >
          {isDesktop && desktopSidebar ? (
            <aside className="ff-shell-sidebar">
              {desktopSidebar}
            </aside>
          ) : null}
          <main className="ff-shell-main">{children}</main>
        </div>
      </Content>
      {stickyActions ? (
        <div
          className="ff-sticky-actions"
          style={{
            padding: isDesktop
              ? '10px 24px 10px'
              : '10px 12px calc(var(--safe-area-inset-bottom, 0px) + 10px)',
          }}
        >
          <div style={{ maxWidth: contentMaxWidth, margin: '0 auto', width: '100%' }}>{stickyActions}</div>
        </div>
      ) : null}
    </Layout>
  );
}
