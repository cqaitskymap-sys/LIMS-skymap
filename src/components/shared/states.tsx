"use client";

import type { ReactNode } from "react";
import { AlertCircle, Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({
  title = "No records found",
  description = "Try adjusting filters or create a new record.",
  icon: Icon = Inbox,
  action,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <Card className="soft-shadow border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-2xl bg-muted p-4">
          <Icon className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <AlertCircle className="size-8 text-destructive" />
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {description || "Please try again in a moment."}
          </p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 soft-shadow">
      <Skeleton className="h-10 w-full rounded-xl" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5 soft-shadow">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("page-enter mx-auto w-full max-w-[1400px] p-4 md:p-6", className)}>
      {children}
    </div>
  );
}
