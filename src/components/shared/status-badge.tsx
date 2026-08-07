"use client";

import { Badge } from "@/components/ui/badge";
import {
  PRIORITY_LABELS,
  ROLE_LABELS,
  SAMPLE_STATUS_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ApprovalStatus, Priority, SampleStatus, UserRole } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  received: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  in_testing: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  in_review: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  cancelled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  released: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  pass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  fail: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  retest: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  available: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  in_use: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  maintenance: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  retired: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  normal: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  urgent: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  true: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  false: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const text =
    label ||
    SAMPLE_STATUS_LABELS[status as SampleStatus] ||
    PRIORITY_LABELS[status as Priority] ||
    ROLE_LABELS[status as UserRole] ||
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full border-0 px-2.5 py-0.5 font-medium capitalize",
        STATUS_STYLES[status] || "bg-muted text-foreground"
      )}
    >
      {text}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active?: boolean }) {
  return (
    <StatusBadge
      status={String(active !== false)}
      label={active !== false ? "Active" : "Inactive"}
    />
  );
}

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  return <StatusBadge status={status} />;
}
