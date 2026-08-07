"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { TableSkeleton } from "@/components/shared/states";
import type { UserRole } from "@/types";

export function AuthGuard({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: UserRole[];
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (profile && profile.isActive === false) {
      router.replace("/login?error=inactive");
      return;
    }
    if (roles && profile && !roles.includes(profile.role)) {
      router.replace("/dashboard");
    }
  }, [loading, user, profile, roles, router, pathname]);

  if (loading) {
    return (
      <div className="p-6">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border bg-card p-6 text-center soft-shadow">
          <h2 className="text-lg font-semibold">Profile setup failed</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Login successful, but Firestore user profile could not be created.
            Check Firestore database and security rules, then refresh.
          </p>
        </div>
      </div>
    );
  }

  if (roles && !roles.includes(profile.role)) {
    return (
      <div className="p-6">
        <TableSkeleton rows={4} />
      </div>
    );
  }

  return <>{children}</>;
}
