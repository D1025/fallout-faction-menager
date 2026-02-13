'use client';

import { Suspense, useState } from 'react';
import { Button, Card, Input, Typography } from 'antd';
import { LockOutlined, LoginOutlined, UserOutlined } from '@ant-design/icons';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { LoadingState } from '@/components/ui/antd/ScreenStates';
import { notifyError } from '@/lib/ui/notify';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-4"><LoadingState /></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [name, setName] = useState('');
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await signIn('credentials', { name, redirect: false });
    if (res?.ok) router.push(next);
    else notifyError('Logowanie nieudane. Sprawdź nazwę użytkownika i spróbuj ponownie.');
  }

  return (
    <MobilePageShell title="Logowanie" backHref="/">
      <div className="grid place-items-center pt-12">
        <Card style={{ width: '100%', maxWidth: 380 }}>
          <Typography.Text type="secondary">Fallout Factions</Typography.Text>
          <Typography.Title level={4} style={{ marginTop: 8 }}>
            <LoginOutlined className="mr-2 text-zinc-300" />
            Panel dowódcy
          </Typography.Title>
          <form onSubmit={submit} className="mt-3 grid gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Overseer"
              prefix={<UserOutlined className="text-zinc-400" />}
            />
            <Button type="primary" htmlType="submit" disabled={name.trim().length < 2} icon={<LockOutlined />}>
              Wejdź do aplikacji
            </Button>
          </form>
        </Card>
      </div>
    </MobilePageShell>
  );
}
