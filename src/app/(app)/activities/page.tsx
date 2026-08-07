"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { COLLECTIONS, PAGE_SIZE } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { exportToCsv, exportToExcel, exportToPdf } from "@/lib/export";
import {
  useCollection,
  useDebouncedValue,
  usePagination,
} from "@/hooks/use-firestore";
import { PageHeader } from "@/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  PageShell,
  TableSkeleton,
} from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActivityLog } from "@/types";

export default function ActivitiesPage() {
  const { data, loading, error } = useCollection<ActivityLog>(
    COLLECTIONS.activities
  );
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debounced = useDebouncedValue(search);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const q = debounced.trim().toLowerCase();
      const matchesSearch =
        !q ||
        row.action.toLowerCase().includes(q) ||
        row.userName.toLowerCase().includes(q) ||
        (row.entityLabel || "").toLowerCase().includes(q);
      const date = row.createdAt?.slice(0, 10) || "";
      const matchesFrom = !from || date >= from;
      const matchesTo = !to || date <= to;
      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [data, debounced, from, to]);

  const { page, setPage, totalPages, pageItems } = usePagination(
    filtered,
    PAGE_SIZE
  );

  const cols = [
    { key: "action", label: "Action" },
    { key: "userName", label: "User" },
    { key: "entityType", label: "Entity" },
    { key: "entityLabel", label: "Label" },
    { key: "createdAt", label: "When" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Activity Logs"
        description="Track logins, sample changes, approvals, and downloads."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Activities" },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                exportToCsv(
                  "activities",
                  filtered as unknown as Record<string, unknown>[],
                  cols
                )
              }
            >
              CSV
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                exportToExcel(
                  "activities",
                  filtered as unknown as Record<string, unknown>[],
                  cols
                )
              }
            >
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                exportToPdf(
                  "Activity Logs",
                  filtered as unknown as Record<string, unknown>[],
                  cols
                )
              }
            >
              PDF
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl pl-9"
            placeholder="Search activity..."
          />
        </div>
        <Input
          type="date"
          className="h-10 rounded-xl"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          type="date"
          className="h-10 rounded-xl"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No activities found" />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card soft-shadow">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.action}</TableCell>
                    <TableCell>{row.userName}</TableCell>
                    <TableCell>
                      {row.entityType}
                      {row.entityLabel ? ` · ${row.entityLabel}` : ""}
                    </TableCell>
                    <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between border-t px-4 py-3 text-sm">
            <span>
              Page {page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
