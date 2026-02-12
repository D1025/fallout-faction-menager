import type { ReactNode } from 'react';
import { Card, Flex, Typography } from 'antd';

export function SectionCard({
  title,
  extra,
  children,
}: {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card size="small" styles={{ body: { padding: 14 } }}>
      {title ? (
        <Flex align="center" justify="space-between" style={{ marginBottom: 10 }}>
          <Typography.Text strong>{title}</Typography.Text>
          {extra}
        </Flex>
      ) : null}
      {children}
    </Card>
  );
}
