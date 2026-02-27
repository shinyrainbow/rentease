import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Returns the session if the user is authenticated and NOT a STAFF user.
 * STAFF users are read-only — they cannot perform create, update, or delete operations.
 */
export async function requireMutationAccess() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (session.user.role === "STAFF") {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Forbidden: Staff users have read-only access" },
        { status: 403 }
      ),
    };
  }

  return { session, error: null };
}
