'use client';

import { useMemo, useState } from 'react';
import { Avatar, Button, Input } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { PhotoCropperModal } from '@/components/images/PhotoCropperModal';
import { hashPasswordForTransport } from '@/lib/auth/passwordTransportClient';
import { confirmAction, notifyApiError, notifyError, notifySuccess, notifyWarning } from '@/lib/ui/notify';

function isPasswordPolicyValid(password: string): boolean {
    if (password.length < 8 || password.length > 128) return false;
    if (!/[A-Za-z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    return true;
}

function readApiError(text: string, fallback: string): string {
    try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed?.error) return parsed.error;
    } catch {
        // noop
    }
    return text || fallback;
}

export function ProfileEditor({
    initialName,
    role,
    initialPhotoEtag,
}: {
    initialName: string;
    role: 'USER' | 'ADMIN';
    initialPhotoEtag?: string | null;
}) {
    const router = useRouter();
    const credentialsLocked = role === 'ADMIN';

    const [name, setName] = useState(initialName);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordRepeat, setNewPasswordRepeat] = useState('');
    const [saving, setSaving] = useState(false);

    const [pick, setPick] = useState<File | null>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoBuster, setPhotoBuster] = useState<string>(initialPhotoEtag ?? '');
    const [photoMissing, setPhotoMissing] = useState(!initialPhotoEtag);

    const hasCredentialsChanges = useMemo(
        () => name.trim() !== initialName || newPassword.length > 0 || currentPassword.length > 0 || newPasswordRepeat.length > 0,
        [currentPassword.length, initialName, name, newPassword.length, newPasswordRepeat.length],
    );

    const photoSrc = photoBuster ? `/api/profile/photo/file?v=${photoBuster}` : '/api/profile/photo/file';

    async function saveProfile() {
        if (credentialsLocked) return;
        const trimmedName = name.trim();
        if (!trimmedName) {
            notifyWarning('Username cannot be empty.');
            return;
        }

        const payload: { name?: string; currentPasswordHash?: string; newPasswordHash?: string } = {};
        if (trimmedName !== initialName) payload.name = trimmedName;

        if (newPassword || newPasswordRepeat || currentPassword) {
            if (!currentPassword) {
                notifyWarning('Enter your current password.');
                return;
            }
            if (newPassword !== newPasswordRepeat) {
                notifyWarning('New passwords do not match.');
                return;
            }
            if (!isPasswordPolicyValid(newPassword)) {
                notifyWarning('Password must be 8-128 chars and include at least one letter and one digit.');
                return;
            }
            payload.currentPasswordHash = await hashPasswordForTransport(currentPassword);
            payload.newPasswordHash = await hashPasswordForTransport(newPassword);
        }

        if (!Object.keys(payload).length) {
            notifyWarning('No changes to save.');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                notifyError(readApiError(text, 'Failed to save profile.'));
                return;
            }

            notifySuccess('Profile saved.');
            setCurrentPassword('');
            setNewPassword('');
            setNewPasswordRepeat('');
            router.refresh();
        } catch {
            notifyError('Secure password hashing failed. Try again.');
        } finally {
            setSaving(false);
        }
    }

    async function uploadPhoto(blob: Blob) {
        setUploadingPhoto(true);
        try {
            const file = new File([blob], 'profile.jpg', { type: blob.type || 'image/jpeg' });
            const form = new FormData();
            form.set('file', file);

            const res = await fetch('/api/profile/photo', { method: 'POST', body: form });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(readApiError(text, 'Failed to upload photo.'));
            }

            const payload = (await res.json().catch(() => null)) as { etag?: string } | null;
            const nextBuster = payload?.etag ?? String(Date.now());
            setPhotoBuster(nextBuster);
            setPhotoMissing(false);
            notifySuccess('Profile photo saved.');
            router.refresh();
        } catch (error) {
            notifyApiError(error, 'Failed to upload profile photo.');
        } finally {
            setUploadingPhoto(false);
            setPick(null);
        }
    }

    function deletePhoto() {
        confirmAction({
            title: 'Delete profile photo?',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onOk: async () => {
                const res = await fetch('/api/profile/photo', { method: 'DELETE' });
                if (!res.ok) throw new Error('delete photo failed');
                setPhotoMissing(true);
                setPhotoBuster(String(Date.now()));
                notifySuccess('Profile photo deleted.');
                router.refresh();
            },
        });
    }

    return (
        <div className="space-y-4">
            <section className="vault-panel p-3">
                <div className="flex items-start gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                        {!photoMissing ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={photoSrc}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                onError={() => setPhotoMissing(true)}
                            />
                        ) : (
                            <div className="grid h-full w-full place-items-center">
                                <Avatar size={44} icon={<UserOutlined />} />
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold">Account: {initialName}</div>
                        <div className="mt-1 text-xs vault-muted">
                            Role: {role === 'ADMIN' ? 'Administrator' : 'User'}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-200">
                                {uploadingPhoto ? 'Uploading...' : photoMissing ? 'Add photo' : 'Change photo'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    disabled={uploadingPhoto}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        e.currentTarget.value = '';
                                        if (!file) return;

                                        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
                                        if (!allowed.includes(file.type)) {
                                            notifyWarning('Supported formats: JPG/PNG/WebP.');
                                            return;
                                        }
                                        if (file.size > 10 * 1024 * 1024) {
                                            notifyWarning('File is too large. Choose an image up to 10MB.');
                                            return;
                                        }
                                        setPick(file);
                                    }}
                                />
                            </label>

                            {!photoMissing ? (
                                <button
                                    type="button"
                                    onClick={deletePhoto}
                                    disabled={uploadingPhoto}
                                    className="h-9 rounded-xl border border-red-700 bg-red-900/30 px-3 text-xs font-medium text-red-200 disabled:opacity-50"
                                >
                                    Delete
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>

            <section className="vault-panel p-3">
                <div className="text-sm font-semibold">Edit profile</div>
                <div className="mt-2 grid gap-2">
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={credentialsLocked}
                        placeholder="Username"
                        prefix={<UserOutlined className="text-zinc-400" />}
                        autoComplete="username"
                    />
                    <Input.Password
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={credentialsLocked}
                        placeholder="Current password"
                        prefix={<LockOutlined className="text-zinc-400" />}
                        autoComplete="current-password"
                    />
                    <Input.Password
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={credentialsLocked}
                        placeholder="New password"
                        prefix={<LockOutlined className="text-zinc-400" />}
                        autoComplete="new-password"
                    />
                    <Input.Password
                        value={newPasswordRepeat}
                        onChange={(e) => setNewPasswordRepeat(e.target.value)}
                        disabled={credentialsLocked}
                        placeholder="Repeat new password"
                        prefix={<LockOutlined className="text-zinc-400" />}
                        autoComplete="new-password"
                    />

                    {credentialsLocked ? (
                        <p className="text-xs vault-muted">
                            Administrator credentials are fixed and cannot be changed from the profile screen.
                        </p>
                    ) : (
                        <p className="text-xs vault-muted">Changing password requires your current password.</p>
                    )}

                    <Button
                        type="primary"
                        onClick={() => void saveProfile()}
                        disabled={credentialsLocked || saving || !hasCredentialsChanges}
                        loading={saving}
                    >
                        Save changes
                    </Button>
                </div>
            </section>

            {pick ? (
                <PhotoCropperModal
                    file={pick}
                    targetSize={400}
                    maxBytes={3 * 1024 * 1024}
                    onCancel={() => setPick(null)}
                    onConfirm={(blob) => void uploadPhoto(blob)}
                />
            ) : null}
        </div>
    );
}
