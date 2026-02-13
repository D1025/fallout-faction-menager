'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, Flex, Typography } from 'antd';
import { SectionCard } from '@/components/ui/antd/SectionCard';

export function EntityListItem({
  title,
  subtitle,
  meta,
  actions,
  href,
  onClickAction,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  href?: string;
  /** Preferowana nazwa w komponentach klienckich (Next TS71007). */
  onClickAction?: () => void;
}) {
  const body = (
    <Flex vertical gap={4}>
      <Flex justify="space-between" align="center" gap={8}>
        <Typography.Text strong>{title}</Typography.Text>
        {meta ? <Typography.Text type="secondary">{meta}</Typography.Text> : null}
      </Flex>
      {subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : null}
      {actions ? <Flex gap={8} wrap>{actions}</Flex> : null}
    </Flex>
  );

  if (href) {
    return (
      <Link href={href} style={{ display: 'block' }}>
        <SectionCard>{body}</SectionCard>
      </Link>
    );
  }

  // Back-compat dla starszych wywołań: <EntityListItem onClick={...} />
  // Nie trzymamy `onClick` w typie, bo Next ostrzega o nie-serializowalnych propsach.
  const legacyOnClick = (arguments[0] as any)?.onClick as undefined | (() => void);
  const click = onClickAction ?? legacyOnClick;

  if (click) {
    return (
      <Button type="text" onClick={click} style={{ padding: 0, height: 'auto', textAlign: 'left', width: '100%' }}>
        <SectionCard>{body}</SectionCard>
      </Button>
    );
  }

  return <SectionCard>{body}</SectionCard>;
}
