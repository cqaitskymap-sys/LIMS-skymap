"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { COLLECTIONS, PAGE_SIZE } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { exportToCsv, exportToExcel, exportToPdf } from "@/lib/export";
import {
  useCollection,
  useDebouncedValue,
  usePagination,
} from "@/hooks/use-firestore";
import { useSearchQueryParam } from "@/hooks/use-search-query";
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditTrailEntry } from "@/types";

const AUDIT_FETCH_LIMIT = 5000;

const ENTITY_LABELS: Record<string, string> = {
  samples: "Samples",
  tests: "Tests",
  reports: "Reports",
  users: "Users",
  departments: "Departments",
  laboratories: "Laboratories",
  products: "Products",
  customers: "Customers",
  materials: "Materials",
  instruments: "Instruments",
  methods: "Methods",
  units: "Units",
  sampleTypes: "Sample Types",
  storageConditions: "Storage",
  testMasters: "Test Masters",
  specifications: "Specifications",
};

const ACTION_LABELS: Record<AuditTrailEntry["action"], string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  approve: "Approve",
  reject: "Reject",
  release: "Release",
};

function formatEntityType(value: string) {
  return (
    ENTITY_LABELS[value] ||
    value.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())
  );
}

function truncateText(value: string, max = 48) {
  if (!value) return "—";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

export default function AuditTrailPage() {
  const { hasPermission } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useCollection<AuditTrailEntry>(
    COLLECTIONS.auditTrail,
    refreshKey,
    AUDIT_FETCH_LIMIT
  );
  const [search, setSearch] = useState("");
  useSearchQueryParam(setSearch);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState<"all" | AuditTrailEntry["action"]>(
    "all"
  );
  const [detail, setDetail] = useState<AuditTrailEntry | null>(null);
  const debounced = useDebouncedValue(search);
  const canExport = hasPermission("export");

  const entityOptions = useMemo(() => {
    const types = new Set(
      data.map((row) => row.entityType).filter(Boolean) as string[]
    );
    return Array.from(types).sort((a, b) =>
      formatEntityType(a).localeCompare(formatEntityType(b))
    );
  }, [data]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    const rows = data.filter((row) => {
      const matchesSearch =
        !q ||
        (row.field || "").toLowerCase().includes(q) ||
        (row.userName || "").toLowerCase().includes(q) ||
        (row.entityLabel || "").toLowerCase().includes(q) ||
        (row.entityType || "").toLowerCase().includes(q) ||
        formatEntityType(row.entityType || "")
          .toLowerCase()
          .includes(q) ||
        (row.entityId || "").toLowerCase().includes(q) ||
        (row.oldValue || "").toLowerCase().includes(q) ||
        (row.newValue || "").toLowerCase().includes(q) ||
        (row.reason || "").toLowerCase().includes(q) ||
        (row.action || "").toLowerCase().includes(q) ||
        (ACTION_LABELS[row.action] || "").toLowerCase().includes(q);
      const date = row.createdAt?.slice(0, 10) || "";
      const matchesFrom = !from || date >= from;
      const matchesTo = !to || date <= to;
      const matchesEntity =
        entityFilter === "all" || row.entityType === entityFilter;
      const matchesAction =
        actionFilter === "all" || row.action === actionFilter;
      return (
        matchesSearch &&
        matchesFrom &&
        matchesTo &&
        matchesEntity &&
        matchesAction
      );
    });

    return rows.sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
  }, [data, debounced, from, to, entityFilter, actionFilter]);

  const { page, setPage, totalPages, pageItems, total } = usePagination(
    filtered,
    PAGE_SIZE
  );

  const dateRangeInvalid = Boolean(from && to && from > to);

  const exportRows = filtered.map((row) => ({
    entityType: formatEntityType(row.entityType),
    entityLabel: row.entityLabel || "",
    entityId: row.entityId || "",
    field: row.field,
    oldValue: row.oldValue || "",
    newValue: row.newValue || "",
    userName: row.userName,
    action: ACTION_LABELS[row.action] || row.action,
    reason: row.reason || "",
    createdAt: formatDateTime(row.createdAt),
  }));

  const cols = [
    { key: "entityType", label: "Entity" },
    { key: "entityLabel", label: "Record" },
    { key: "field", label: "Field" },
    { key: "oldValue", label: "Old Value" },
    { key: "newValue", label: "New Value" },
    { key: "userName", label: "User" },
    { key: "action", label: "Action" },
    { key: "reason", label: "Reason" },
    { key: "createdAt", label: "Date/Time" },
  ];

  const clearFilters = () => {
    setSearch("");
    setFrom("");
    setTo("");
    setEntityFilter("all");
    setActionFilter("all");
  };

  const handleExport = (type: "csv" | "excel" | "pdf") => {
    if (!canExport) {
      toast.error("You do not have export permission");
      return;
    }
    if (dateRangeInvalid) {
      toast.error("From date cannot be after To date");
      return;
    }
    if (filtered.length === 0) {
      toast.error("No audit entries to export");
      return;
    }
    if (type === "csv") exportToCsv("audit-trail", exportRows, cols);
    if (type === "excel") exportToExcel("audit-trail", exportRows, cols);
    if (type === "pdf") exportToPdf("Audit Trail", exportRows, cols);
  };

  const hasFilters = Boolean(
    search || from || to || entityFilter !== "all" || actionFilter !== "all"
  );

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
          canExport ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl">
                  <Download className="mr-2 size-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                  <FileSpreadsheet className="mr-2 size-4" />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl pl-9"
            placeholder="Search field, record, values, reason..."
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {entityOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {formatEntityType(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={actionFilter}
          onValueChange={(value) =>
            setActionFilter(value as "all" | AuditTrailEntry["action"])
          }
        >
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {(Object.keys(ACTION_LABELS) as AuditTrailEntry["action"][]).map(
              (action) => (
                <SelectItem key={action} value={action}>
                  {ACTION_LABELS[action]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <div className="space-y-1">
          <Label className="sr-only">From</Label>
          <Input
            type="date"
            className="h-10 rounded-xl"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="From date"
          />
        </div>
        <div className="space-y-1">
          <Label className="sr-only">To</Label>
          <Input
            type="date"
            className="h-10 rounded-xl"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="To date"
          />
        </div>
      </div>

      {(hasFilters || dateRangeInvalid) && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          {dateRangeInvalid ? (
            <p className="text-destructive">From date cannot be after To date.</p>
          ) : (
            <p className="text-muted-foreground">
              Showing {filtered.length.toLocaleString()} matching entr
              {filtered.length === 1 ? "y" : "ies"}
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}

      {data.length >= AUDIT_FETCH_LIMIT && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
          Showing the latest {AUDIT_FETCH_LIMIT.toLocaleString()} audit entries.
          Older entries may not appear.
        </p>
      )}

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState
          description={error}
          onRetry={() => setRefreshKey((k) => k + 1)}
        />
      ) : dateRangeInvalid ? (
        <EmptyState
          title="Invalid date range"
          description="Adjust the From and To dates, then try again."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No audit entries"
          description={
            hasFilters
              ? "Try adjusting search or filters."
              : "Field-level changes will appear here as records are updated."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
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
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => setDetail(row)}
                  >
                    <TableCell>
                      <div className="font-medium">
                        {row.entityLabel || row.entityId || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatEntityType(row.entityType)}
                      </div>
                    </TableCell>
                    <TableCell>{row.field}</TableCell>
                    <TableCell className="max-w-[140px]">
                      {truncateText(row.oldValue)}
                    </TableCell>
                    <TableCell className="max-w-[140px]">
                      {truncateText(row.newValue)}
                    </TableCell>
                    <TableCell>{row.userName || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={row.action}
                        label={ACTION_LABELS[row.action] || row.action}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {total} entries · Page {page}/{totalPages}
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

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detail?.entityLabel || detail?.entityId || "Audit entry"}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="grid gap-3 text-sm">
              <p>
                <span className="text-muted-foreground">When:</span>{" "}
                {formatDateTime(detail.createdAt)}
              </p>
              <p>
                <span className="text-muted-foreground">Action:</span>{" "}
                {ACTION_LABELS[detail.action] || detail.action}
              </p>
              <p>
                <span className="text-muted-foreground">User:</span>{" "}
                {detail.userName || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Entity:</span>{" "}
                {formatEntityType(detail.entityType)}
              </p>
              <p>
                <span className="text-muted-foreground">Entity ID:</span>{" "}
                <span className="font-mono text-xs">{detail.entityId}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Field:</span>{" "}
                {detail.field}
              </p>
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Old value</p>
                <p className="mt-1 break-words whitespace-pre-wrap">
                  {detail.oldValue || "—"}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">New value</p>
                <p className="mt-1 break-words whitespace-pre-wrap">
                  {detail.newValue || "—"}
                </p>
              </div>
              <p>
                <span className="text-muted-foreground">Reason:</span>{" "}
                {detail.reason || "—"}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
