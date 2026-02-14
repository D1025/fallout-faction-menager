'use client';

import { Suspense, useMemo, useState } from 'react';
import { Button, Card, Input, Segmented, Typography } from 'antd';
import { LockOutlined, LoginOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { LoadingState } from '@/components/ui/antd/ScreenStates';
import { notifyError, notifySuccess } from '@/lib/ui/notify';

type Mode = 'login' | 'register';

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="p-4"><LoadingState /></div>}>
            <LoginForm />
        </Suspense>
    );
}

function LoginForm() {
    const [mode, setMode] = useState<Mode>('login');

    const [loginName, setLoginName] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    const [registerName, setRegisterName] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [registerPasswordRepeat, setRegisterPasswordRepeat] = useState('');

    const [busy, setBusy] = useState(false);

    const router = useRouter();
    const sp = useSearchParams();
    const next = sp.get('next') || '/';

    const canLogin = useMemo(() => loginName.trim().length >= 3 && loginPassword.length >= 8, [loginName, loginPassword]);
    const canRegister = useMemo(
        () => registerName.trim().length >= 3 && registerPassword.length >= 8 && registerPasswordRepeat.length >= 8,
        [registerName, registerPassword, registerPasswordRepeat],
    );

    async function submitLogin(e: React.FormEvent) {
        e.preventDefault();
        if (!canLogin || busy) return;

        setBusy(true);
        try {
            const res = await signIn('credentials', {
                name: loginName.trim(),
                password: loginPassword,
                redirect: false,
            });
            if (res?.ok) {
                router.push(next);
                return;
            }
            notifyError('Logowanie nieudane. Sprawdz login i haslo.');
        } finally {
            setBusy(false);
        }
    }

    async function submitRegister(e: React.FormEvent) {
        e.preventDefault();
        if (!canRegister || busy) return;

        if (registerPassword !== registerPasswordRepeat) {
            notifyError('Hasla nie sa takie same.');
            return;
        }

        setBusy(true);
        try {
            const registerRes = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: registerName.trim(),
                    password: registerPassword,
                }),
            });

            if (!registerRes.ok) {
                const errorText = await registerRes.text().catch(() => '');
                let errorMessage = 'Nie udalo sie utworzyc konta.';
                try {
                    const parsed = JSON.parse(errorText) as { error?: string };
                    if (parsed?.error) errorMessage = parsed.error;
                } catch {
                    if (errorText) errorMessage = errorText;
                }
                notifyError(errorMessage);
                return;
            }

            notifySuccess('Konto zostalo utworzone.');
            const signInRes = await signIn('credentials', {
                name: registerName.trim(),
                password: registerPassword,
                redirect: false,
            });
            if (!signInRes?.ok) {
                notifyError('Konto utworzone, ale nie udalo sie zalogowac. Sprobuj recznie.');
                setMode('login');
                setLoginName(registerName.trim());
                setLoginPassword('');
                return;
            }

            router.push(next);
        } finally {
            setBusy(false);
        }
    }

    return (
        <MobilePageShell title="Logowanie">
            <div className="grid place-items-center pt-10">
                <Card style={{ width: '100%', maxWidth: 400 }}>
                    <Typography.Text type="secondary">Fallout Factions</Typography.Text>
                    <Typography.Title level={4} style={{ marginTop: 8 }}>
                        <LoginOutlined className="mr-2 text-zinc-300" />
                        Panel dowodcy
                    </Typography.Title>

                    <div className="mt-3">
                        <Segmented<Mode>
                            block
                            value={mode}
                            onChange={(value) => setMode(value)}
                            options={[
                                { label: 'Logowanie', value: 'login', icon: <LoginOutlined /> },
                                { label: 'Rejestracja', value: 'register', icon: <UserAddOutlined /> },
                            ]}
                        />
                    </div>

                    {mode === 'login' ? (
                        <form onSubmit={submitLogin} className="mt-3 grid gap-2">
                            <Input
                                value={loginName}
                                onChange={(e) => setLoginName(e.target.value)}
                                placeholder="np. Overseer"
                                autoComplete="username"
                                prefix={<UserOutlined className="text-zinc-400" />}
                            />
                            <Input.Password
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="Haslo"
                                autoComplete="current-password"
                                prefix={<LockOutlined className="text-zinc-400" />}
                            />
                            <Button
                                type="primary"
                                htmlType="submit"
                                disabled={!canLogin || busy}
                                loading={busy}
                                icon={<LoginOutlined />}
                            >
                                Zaloguj
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={submitRegister} className="mt-3 grid gap-2">
                            <Input
                                value={registerName}
                                onChange={(e) => setRegisterName(e.target.value)}
                                placeholder="Nazwa uzytkownika"
                                autoComplete="username"
                                prefix={<UserOutlined className="text-zinc-400" />}
                            />
                            <Input.Password
                                value={registerPassword}
                                onChange={(e) => setRegisterPassword(e.target.value)}
                                placeholder="Haslo (min. 8 znakow, litera i cyfra)"
                                autoComplete="new-password"
                                prefix={<LockOutlined className="text-zinc-400" />}
                            />
                            <Input.Password
                                value={registerPasswordRepeat}
                                onChange={(e) => setRegisterPasswordRepeat(e.target.value)}
                                placeholder="Powtorz haslo"
                                autoComplete="new-password"
                                prefix={<LockOutlined className="text-zinc-400" />}
                            />
                            <Button
                                type="primary"
                                htmlType="submit"
                                disabled={!canRegister || busy}
                                loading={busy}
                                icon={<UserAddOutlined />}
                            >
                                Utworz konto
                            </Button>
                        </form>
                    )}
                </Card>
            </div>
        </MobilePageShell>
    );
}
