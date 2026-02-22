export const dynamic = 'force-dynamic';

import { auth } from "@/lib/authServer";
import { mkdir, writeFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import { checkRateLimit, getClientIp, tooManyRequestsResponse } from '@/lib/security/rateLimit';

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);

export async function POST(req: Request) {
    const ip = getClientIp(req);
    const ipLimit = checkRateLimit({
        key: `upload:admin:ip:${ip}`,
        limit: 30,
        windowMs: 60_000,
    });
    if (!ipLimit.ok) return tooManyRequestsResponse(ipLimit.retryAfterSec);

    const session = await auth();
    if (session?.user.role !== "ADMIN") return new Response("FORBIDDEN", { status: 403 });

    const userLimit = checkRateLimit({
        key: `upload:admin:user:${session.user.id}`,
        limit: 20,
        windowMs: 60_000,
    });
    if (!userLimit.ok) return tooManyRequestsResponse(userLimit.retryAfterSec);

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
        return new Response("Unsupported Media Type", { status: 415 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return new Response("No file", { status: 400 });
    if (!ALLOWED_MIME.has(file.type)) return new Response("Unsupported Media Type", { status: 415 });

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return new Response("Payload Too Large", { status: 413 });
    const ext = path.extname(file.name || "").toLowerCase() || ".bin";

    const hash = createHash("sha1").update(buf).digest("hex").slice(0, 16);
    const fname = `${Date.now()}_${hash}${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "weapons");
    await mkdir(dir, { recursive: true });
    const abs = path.join(dir, fname);
    await writeFile(abs, buf);

    const publicPath = `/uploads/weapons/${fname}`;
    return new Response(JSON.stringify({ path: publicPath }), { status: 201 });
}
