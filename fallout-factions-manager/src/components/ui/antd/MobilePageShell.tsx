'use client';

import type { ReactNode } from 'react';
import { BookOutlined } from '@ant-design/icons';
import { Button, Grid, Layout } from 'antd';
import Content from 'antd/es/layout/layout';
import { AppHeader } from '@/components/nav/AppHeader';

const SAFE_AREA_VAR = '--safe-area-inset-bottom';
const SAFE_AREA_TOP_VAR = '--safe-area-inset-top';

export function MobilePageShell({
  title,
  backHref,
  headerRight,
  children,
  stickyActions,
  desktopSidebar,
  showStoryActionsShortcut = true,
}: {
  title: string;
  backHref?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  stickyActions?: ReactNode;
  desktopSidebar?: ReactNode;
  showStoryActionsShortcut?: boolean;
}) {
  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.lg);
  const contentMaxWidth = isDesktop ? 1200 : 560;
  const hasHeaderActions = showStoryActionsShortcut || Boolean(headerRight);
  const resolvedHeaderRight = hasHeaderActions ? (
    <div className="ff-app-header__actions">
      {showStoryActionsShortcut ? (
        <Button
          href="/story-actions"
          icon={<BookOutlined />}
          aria-label="Story actions"
          title="Story actions"
          className="ff-ant-btn-icon-mobile ff-header-action-btn"
        >
          Story actions
        </Button>
      ) : null}
      {headerRight}
    </div>
  ) : undefined;

  return (
    <Layout
      className="ff-shell"
      style={{
        [SAFE_AREA_VAR]: 'env(safe-area-inset-bottom, 0px)',
        ['--safe-area-inset-bottom-legacy']: 'constant(safe-area-inset-bottom, 0px)',
        [SAFE_AREA_TOP_VAR]: 'env(safe-area-inset-top, 0px)',
        ['--safe-area-inset-top-legacy']: 'constant(safe-area-inset-top, 0px)',
      } as React.CSSProperties}
    >
      <AppHeader title={title} backHref={backHref} right={resolvedHeaderRight} maxWidth={contentMaxWidth} />
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
