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
  onClick,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  href?: string;
  onClick?: () => void;
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

  if (onClick) {
    return (
      <Button type="text" onClick={onClick} style={{ padding: 0, height: 'auto', textAlign: 'left', width: '100%' }}>
        <SectionCard>{body}</SectionCard>
      </Button>
    );
  }

  return <SectionCard>{body}</SectionCard>;
}
