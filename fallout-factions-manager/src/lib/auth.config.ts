import type { AuthOptions, Session, User as NAUser } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/server/prisma";

/* ===== Augmentacja typów ===== */
declare module "next-auth" {
    interface Session {
        user: { id: string; name: string; role: "USER" | "ADMIN" };
    }
    interface User {
        id: string;
        name: string;
        role: "USER" | "ADMIN";
    }
}
declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        role: "USER" | "ADMIN";
        name?: string;
    }
}

type AppUser = { id: string; name: string; role: "USER" | "ADMIN" };

export const authOptions: AuthOptions = {
    providers: [
        Credentials({
            name: "Login",
            credentials: { name: { label: "Nick", type: "text" } },
            async authorize(creds): Promise<AppUser | null> {
                const raw = creds?.name ?? "";
                const name = String(raw).trim();
                if (!name) return null;

                const existing = await prisma.user.findFirst({ where: { name } });
                if (existing) return { id: existing.id, name: existing.name, role: existing.role as "USER" | "ADMIN" };

                const created = await prisma.user.create({ data: { name } });
                return { id: created.id, name: created.name, role: created.role as "USER" | "ADMIN" };
            },
        }),
    ],
    session: { strategy: "jwt" },
    callbacks: {
        async jwt({ token, user }: { token: JWT; user?: AppUser | NAUser | null }) {
            if (user) {
                const u = user as AppUser;
                token.id = u.id;
                token.role = u.role;
                token.name = u.name;
            }
            return token;
        },
        async session({ session, token }: { session: Session; token: JWT }) {
            session.user = { id: token.id, name: token.name ?? (session.user?.name ?? ""), role: token.role };
            return session;
        },
    },
    pages: { signIn: "/login" },
    secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions;
