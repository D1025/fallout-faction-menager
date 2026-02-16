type AuthRole = 'USER' | 'ADMIN';

type JwtType = 'access' | 'refresh';

type TokenPayloadBase = {
    sub: string;
    name: string;
    role: AuthRole;
    type: JwtType;
    iat: number;
    exp: number;
    jti: string;
};

export type AccessTokenPayload = TokenPayloadBase & { type: 'access' };
export type RefreshTokenPayload = TokenPayloadBase & { type: 'refresh' };

export type AuthUser = {
    id: string;
    name: string;
    role: AuthRole;
};

export type TokenPair = {
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: number;
    refreshExpiresAt: number;
};

export const ACCESS_COOKIE_NAME = 'ff_access';
export const REFRESH_COOKIE_NAME = 'ff_refresh';
export const AUTH_USER_HEADER = 'x-ff-auth-user';
export const AUTH_ACCESS_HEADER = 'x-ff-access-token';

const ACCESS_TTL_SEC = parseDurationSec(process.env.AUTH_ACCESS_TTL_SEC, 15 * 60);
const REFRESH_TTL_SEC = parseDurationSec(process.env.AUTH_REFRESH_TTL_SEC, 30 * 24 * 60 * 60);

const ACCESS_SECRET = getSecret('AUTH_ACCESS_SECRET');
const REFRESH_SECRET = getSecret('AUTH_REFRESH_SECRET');

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function parseDurationSec(raw: string | undefined, fallback: number): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
}

function getSecret(key: string): string {
    const fromKey = process.env[key];
    if (fromKey && fromKey.length >= 16) return fromKey;
    const fallback = process.env.NEXTAUTH_SECRET;
    if (fallback && fallback.length >= 16) return fallback;
    if (process.env.NODE_ENV === 'production') {
        throw new Error(`Missing auth secret: ${key}`);
    }
    return `${key}_dev_only_change_me_1234567890`;
}

function nowSec(): number {
    return Math.floor(Date.now() / 1000);
}

function randomId(bytes = 16): string {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return toBase64Url(arr);
}

function normalizeBase64(base64url: string): string {
    const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const mod = padded.length % 4;
    if (mod === 0) return padded;
    return padded + '='.repeat(4 - mod);
}

function toBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(base64, 'base64'));
    }
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

function toBase64Url(bytes: Uint8Array): string {
    return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(base64url: string): Uint8Array {
    return fromBase64(normalizeBase64(base64url));
}

function encodeJson(obj: unknown): string {
    return toBase64Url(textEncoder.encode(JSON.stringify(obj)));
}

function decodeJson<T>(value: string): T | null {
    try {
        const raw = textDecoder.decode(fromBase64Url(value));
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

async function signHmacSha256(data: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(data));
    return toBase64Url(new Uint8Array(signature));
}

function timingSafeEqualString(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let out = 0;
    for (let i = 0; i < a.length; i++) {
        out |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return out === 0;
}

async function createJwt(payload: TokenPayloadBase, secret: string): Promise<string> {
    const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
    const body = encodeJson(payload);
    const data = `${header}.${body}`;
    const signature = await signHmacSha256(data, secret);
    return `${data}.${signature}`;
}

async function verifyJwtCore(token: string, secret: string): Promise<TokenPayloadBase | null> {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    if (!h || !p || !s) return null;

    const expectedSig = await signHmacSha256(`${h}.${p}`, secret);
    if (!timingSafeEqualString(expectedSig, s)) return null;

    const payload = decodeJson<TokenPayloadBase>(p);
    if (!payload) return null;

    if (!payload.sub || !payload.name || !payload.role || !payload.type || !payload.exp || !payload.iat) return null;
    if (payload.role !== 'USER' && payload.role !== 'ADMIN') return null;
    if (payload.exp <= nowSec()) return null;

    return payload;
}

export async function issueTokenPair(user: AuthUser): Promise<TokenPair> {
    const iat = nowSec();
    const accessExpiresAt = iat + ACCESS_TTL_SEC;
    const refreshExpiresAt = iat + REFRESH_TTL_SEC;

    const accessPayload: AccessTokenPayload = {
        sub: user.id,
        name: user.name,
        role: user.role,
        type: 'access',
        iat,
        exp: accessExpiresAt,
        jti: randomId(),
    };
    const refreshPayload: RefreshTokenPayload = {
        sub: user.id,
        name: user.name,
        role: user.role,
        type: 'refresh',
        iat,
        exp: refreshExpiresAt,
        jti: randomId(),
    };

    const accessToken = await createJwt(accessPayload, ACCESS_SECRET);
    const refreshToken = await createJwt(refreshPayload, REFRESH_SECRET);

    return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    const payload = await verifyJwtCore(token, ACCESS_SECRET);
    if (!payload || payload.type !== 'access') return null;
    return payload as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
    const payload = await verifyJwtCore(token, REFRESH_SECRET);
    if (!payload || payload.type !== 'refresh') return null;
    return payload as RefreshTokenPayload;
}

export function userFromPayload(payload: Pick<TokenPayloadBase, 'sub' | 'name' | 'role'>): AuthUser {
    return {
        id: payload.sub,
        name: payload.name,
        role: payload.role,
    };
}

export function encodeAuthUserHeader(user: AuthUser): string {
    return encodeJson(user);
}

export function decodeAuthUserHeader(value: string | null | undefined): AuthUser | null {
    if (!value) return null;
    const parsed = decodeJson<AuthUser>(value);
    if (!parsed) return null;
    if (!parsed.id || !parsed.name || (parsed.role !== 'USER' && parsed.role !== 'ADMIN')) return null;
    return parsed;
}

export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

export function accessTtlSec(): number {
    return ACCESS_TTL_SEC;
}

export function refreshTtlSec(): number {
    return REFRESH_TTL_SEC;
}

