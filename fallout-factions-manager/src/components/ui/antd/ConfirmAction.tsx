'use client';

import type { ReactNode } from 'react';
import { Button, Popconfirm } from 'antd';

export function ConfirmAction({
  title,
  description,
  onConfirm,
  children,
  danger,
}: {
  title: ReactNode;
  description?: ReactNode;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <Popconfirm title={title} description={description} onConfirm={onConfirm} okText="Tak" cancelText="Anuluj">
      <Button danger={danger} size="small">
        {children}
      </Button>
    </Popconfirm>
  );
}
