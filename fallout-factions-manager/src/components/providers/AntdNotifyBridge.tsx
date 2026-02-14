'use client';

import { App } from 'antd';
import { useEffect } from 'react';
import { bindConfirmActionModal } from '@/lib/ui/notify';

export function AntdNotifyBridge() {
  const { modal } = App.useApp();

  useEffect(() => {
    bindConfirmActionModal(modal.confirm);
    return () => bindConfirmActionModal(null);
  }, [modal]);

  return null;
}

