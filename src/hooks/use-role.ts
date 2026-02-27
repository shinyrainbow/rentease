"use client";

import { useSession } from "next-auth/react";

/**
 * Returns whether the current user can perform mutations (create/edit/delete).
 * STAFF users are read-only.
 */
export function useCanMutate(): boolean {
  const { data: session } = useSession();
  return session?.user?.role !== "STAFF";
}
