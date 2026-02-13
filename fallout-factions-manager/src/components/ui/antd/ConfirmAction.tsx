'use client';

import type { ReactNode } from 'react';
import { Button } from 'antd';
import { confirmAction } from '@/lib/ui/notify';

export function ConfirmAction({
  title,
  description,
  onConfirm,
  children,
  danger,
  okText,
}: {
  title: ReactNode;
  description?: ReactNode;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  danger?: boolean;
  okText?: string;
}) {
  return (
    <Button
      danger={danger}
      size="small"
      onClick={() =>
        confirmAction({
          title: typeof title === 'string' ? title : 'Potwierdź akcję',
          content: typeof description === 'string' ? description : undefined,
          okText: okText ?? 'Tak, wykonaj',
          cancelText: 'Anuluj',
          danger,
          onOk: async () => {
            await onConfirm();
          },
        })
      }
    >
      {children}
    </Button>
  );
}
