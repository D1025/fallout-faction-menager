'use client';

export async function hashPasswordForTransport(password: string): Promise<string> {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        throw new Error('Secure hashing is unavailable in this environment.');
    }
    const bytes = new TextEncoder().encode(password);
    const digest = await subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    return hex;
}
