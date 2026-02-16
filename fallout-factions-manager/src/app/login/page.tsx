'use client';

import { Suspense, useMemo, useState } from 'react';
import { Button, Card, Input, Segmented, Typography } from 'antd';
import { LockOutlined, LoginOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { LoadingState } from '@/components/ui/antd/ScreenStates';
import { hashPasswordForTransport } from '@/lib/auth/passwordTransportClient';
import { notifyError, notifySuccess } from '@/lib/ui/notify';

type Mode = 'login' | 'register';

function isPasswordPolicyValid(password: string): boolean {
    if (password.length < 8 || password.length > 128) return false;
    if (!/[A-Za-z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    return true;
}

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
        () => registerName.trim().length >= 3 && isPasswordPolicyValid(registerPassword) && registerPasswordRepeat.length >= 8,
        [registerName, registerPassword, registerPasswordRepeat],
    );

    async function readApiError(res: Response, fallback: string): Promise<string> {
        const text = await res.text().catch(() => '');
        if (!text) return fallback;
        try {
            const parsed = JSON.parse(text) as { error?: string };
            return parsed.error || fallback;
        } catch {
            return text || fallback;
        }
    }

    async function submitLogin(e: React.FormEvent) {
        e.preventDefault();
        if (!canLogin || busy) return;

        setBusy(true);
        try {
            const passwordHash = await hashPasswordForTransport(loginPassword);
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: loginName.trim(),
                    passwordHash,
                }),
            });
            if (res.ok) {
                router.push(next);
                return;
            }
            notifyError(await readApiError(res, 'Login failed. Check your username and password.'));
        } catch {
            notifyError('Secure password hashing failed. Try again.');
        } finally {
            setBusy(false);
        }
    }

    async function submitRegister(e: React.FormEvent) {
        e.preventDefault();
        if (!canRegister || busy) return;

        if (registerPassword !== registerPasswordRepeat) {
            notifyError('Passwords do not match.');
            return;
        }
        if (!isPasswordPolicyValid(registerPassword)) {
            notifyError('Password must be 8-128 chars and include at least one letter and one digit.');
            return;
        }

        setBusy(true);
        try {
            const registerPasswordHash = await hashPasswordForTransport(registerPassword);
            const registerRes = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: registerName.trim(),
                    passwordHash: registerPasswordHash,
                }),
            });

            if (!registerRes.ok) {
                notifyError(await readApiError(registerRes, 'Failed to create account.'));
                return;
            }

            notifySuccess('Account created.');
            const loginPasswordHash = await hashPasswordForTransport(registerPassword);
            const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: registerName.trim(),
                    passwordHash: loginPasswordHash,
                }),
            });
            if (!loginRes.ok) {
                notifyError('Account created, but automatic sign-in failed. Please sign in manually.');
                setMode('login');
                setLoginName(registerName.trim());
                setLoginPassword('');
                return;
            }

            router.push(next);
        } catch {
            notifyError('Secure password hashing failed. Try again.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <MobilePageShell title="Login">
            <div className="grid place-items-center pt-10">
                <Card style={{ width: '100%', maxWidth: 400 }}>
                    <Typography.Text type="secondary">Fallout Factions</Typography.Text>
                    <Typography.Title level={4} style={{ marginTop: 8 }}>
                        <LoginOutlined className="mr-2 text-zinc-300" />
                        Commander panel
                    </Typography.Title>

                    <div className="mt-3">
                        <Segmented<Mode>
                            block
                            value={mode}
                            onChange={(value) => setMode(value)}
                            options={[
                                { label: 'Login', value: 'login', icon: <LoginOutlined /> },
                                { label: 'Register', value: 'register', icon: <UserAddOutlined /> },
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
                                placeholder="Password"
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
                                Sign in
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={submitRegister} className="mt-3 grid gap-2">
                            <Input
                                value={registerName}
                                onChange={(e) => setRegisterName(e.target.value)}
                                placeholder="Username"
                                autoComplete="username"
                                prefix={<UserOutlined className="text-zinc-400" />}
                            />
                            <Input.Password
                                value={registerPassword}
                                onChange={(e) => setRegisterPassword(e.target.value)}
                                placeholder="Password (min. 8 chars, letter and number)"
                                autoComplete="new-password"
                                prefix={<LockOutlined className="text-zinc-400" />}
                            />
                            <Input.Password
                                value={registerPasswordRepeat}
                                onChange={(e) => setRegisterPasswordRepeat(e.target.value)}
                                placeholder="Repeat password"
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
                                Create account
                            </Button>
                        </form>
                    )}
                </Card>
            </div>
        </MobilePageShell>
    );
}
