export const dynamic = 'force-dynamic';

import { auth } from "@/lib/authServer";
import { mkdir, writeFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";

export async function POST(req: Request) {
    const session = await auth();
    if (session?.user.role !== "ADMIN") return new Response("FORBIDDEN", { status: 403 });

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
        return new Response("Unsupported Media Type", { status: 415 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return new Response("No file", { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
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
