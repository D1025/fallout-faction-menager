import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

/** Używaj: const session = await auth(); */
export const auth = () => getServerSession(authOptions);
