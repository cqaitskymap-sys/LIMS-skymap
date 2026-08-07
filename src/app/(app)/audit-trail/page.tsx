"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { COLLECTIONS, PAGE_SIZE } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { exportToExcel, exportToPdf } from "@/lib/export";
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
import { StatusBadge } from "@/components/shared/status-badge";
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
import type { AuditTrailEntry } from "@/types";

export default function AuditTrailPage() {
  const { data, loading, error } = useCollection<AuditTrailEntry>(
    COLLECTIONS.auditTrail
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
        row.field.toLowerCase().includes(q) ||
        row.userName.toLowerCase().includes(q) ||
        (row.entityLabel || "").toLowerCase().includes(q) ||
        row.oldValue.toLowerCase().includes(q) ||
        row.newValue.toLowerCase().includes(q);
      const date = row.createdAt?.slice(0, 10) || "";
      return matchesSearch && (!from || date >= from) && (!to || date <= to);
    });
  }, [data, debounced, from, to]);

  const { page, setPage, totalPages, pageItems } = usePagination(
    filtered,
    PAGE_SIZE
  );

  const cols = [
    { key: "entityLabel", label: "Record" },
    { key: "field", label: "Field" },
    { key: "oldValue", label: "Old Value" },
    { key: "newValue", label: "New Value" },
    { key: "userName", label: "User" },
    { key: "reason", label: "Reason" },
    { key: "createdAt", label: "Date/Time" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Audit Trail"
        description="Immutable change history with old/new values for compliance."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Audit Trail" },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                exportToExcel(
                  "audit-trail",
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
                  "Audit Trail",
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
            placeholder="Search audit trail..."
          />
        </div>
        <Input type="date" className="h-10 rounded-xl" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" className="h-10 rounded-xl" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No audit entries" />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card soft-shadow">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Old</TableHead>
                  <TableHead>New</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.entityLabel || row.entityId}</TableCell>
                    <TableCell>{row.field}</TableCell>
                    <TableCell className="max-w-[140px] truncate">
                      {row.oldValue || "—"}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate">
                      {row.newValue || "—"}
                    </TableCell>
                    <TableCell>{row.userName}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.action} />
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
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
