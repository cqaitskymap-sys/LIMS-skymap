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
import type { ActivityLog } from "@/types";

const ACTIVITY_FETCH_LIMIT = 5000;

const ENTITY_LABELS: Record<string, string> = {
  samples: "Samples",
  tests: "Tests",
  reports: "Reports",
  users: "Users",
  user: "Users",
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
  notifications: "Notifications",
};

function formatEntityType(value: string) {
  return ENTITY_LABELS[value] || value.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function truncateText(value: string, max = 64) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

export default function ActivitiesPage() {
  const { hasPermission } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useCollection<ActivityLog>(
    COLLECTIONS.activities,
    refreshKey,
    ACTIVITY_FETCH_LIMIT
  );
  const [search, setSearch] = useState("");
  useSearchQueryParam(setSearch);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [detail, setDetail] = useState<ActivityLog | null>(null);
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
        (row.action || "").toLowerCase().includes(q) ||
        (row.userName || "").toLowerCase().includes(q) ||
        (row.userEmail || "").toLowerCase().includes(q) ||
        (row.entityType || "").toLowerCase().includes(q) ||
        formatEntityType(row.entityType || "")
          .toLowerCase()
          .includes(q) ||
        (row.entityLabel || "").toLowerCase().includes(q) ||
        (row.details || "").toLowerCase().includes(q) ||
        (row.entityId || "").toLowerCase().includes(q);
      const date = row.createdAt?.slice(0, 10) || "";
      const matchesFrom = !from || date >= from;
      const matchesTo = !to || date <= to;
      const matchesEntity =
        entityFilter === "all" || row.entityType === entityFilter;
      return matchesSearch && matchesFrom && matchesTo && matchesEntity;
    });

    return rows.sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
  }, [data, debounced, from, to, entityFilter]);

  const { page, setPage, totalPages, pageItems, total } = usePagination(
    filtered,
    PAGE_SIZE
  );

  const dateRangeInvalid = Boolean(from && to && from > to);

  const exportRows = filtered.map((row) => ({
    action: row.action,
    userName: row.userName,
    userEmail: row.userEmail || "",
    entityType: formatEntityType(row.entityType),
    entityLabel: row.entityLabel || "",
    entityId: row.entityId || "",
    details: row.details || "",
    createdAt: formatDateTime(row.createdAt),
  }));

  const cols = [
    { key: "action", label: "Action" },
    { key: "userName", label: "User" },
    { key: "userEmail", label: "Email" },
    { key: "entityType", label: "Entity" },
    { key: "entityLabel", label: "Label" },
    { key: "details", label: "Details" },
    { key: "createdAt", label: "When" },
  ];

  const clearFilters = () => {
    setSearch("");
    setFrom("");
    setTo("");
    setEntityFilter("all");
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
      toast.error("No activities to export");
      return;
    }
    if (type === "csv") exportToCsv("activities", exportRows, cols);
    if (type === "excel") exportToExcel("activities", exportRows, cols);
    if (type === "pdf") exportToPdf("Activity Logs", exportRows, cols);
  };

  const hasFilters = Boolean(
    search || from || to || entityFilter !== "all"
  );

  return (
    <PageShell>
      <PageHeader
        title="Activity Logs"
        description="Track logins, sample changes, approvals, master updates, and system actions."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Activities" },
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

      <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl pl-9"
            placeholder="Search action, user, entity, details..."
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
              Showing {filtered.length.toLocaleString()} matching activit
              {filtered.length === 1 ? "y" : "ies"}
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}

      {data.length >= ACTIVITY_FETCH_LIMIT && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
          Showing the latest {ACTIVITY_FETCH_LIMIT.toLocaleString()} activities.
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
          title="No activities found"
          description={
            hasFilters
              ? "Try adjusting search or date filters."
              : "Activity will appear here as users work in the system."
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
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
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
                    <TableCell className="font-medium">{row.action}</TableCell>
                    <TableCell>
                      <div>{row.userName || "—"}</div>
                      {row.userEmail ? (
                        <div className="text-xs text-muted-foreground">
                          {row.userEmail}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div>{formatEntityType(row.entityType)}</div>
                      {row.entityLabel ? (
                        <div className="text-xs text-muted-foreground">
                          {row.entityLabel}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[220px] text-muted-foreground">
                      {row.details ? truncateText(row.details) : "—"}
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
              {total} activities · Page {page}/{totalPages}
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
            <DialogTitle>{detail?.action || "Activity"}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="grid gap-3 text-sm">
              <p>
                <span className="text-muted-foreground">When:</span>{" "}
                {formatDateTime(detail.createdAt)}
              </p>
              <p>
                <span className="text-muted-foreground">User:</span>{" "}
                {detail.userName || "—"}
                {detail.userEmail ? ` (${detail.userEmail})` : ""}
              </p>
              <p>
                <span className="text-muted-foreground">Entity:</span>{" "}
                {formatEntityType(detail.entityType)}
                {detail.entityLabel ? ` · ${detail.entityLabel}` : ""}
              </p>
              {detail.entityId ? (
                <p>
                  <span className="text-muted-foreground">Entity ID:</span>{" "}
                  <span className="font-mono text-xs">{detail.entityId}</span>
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Details:</span>{" "}
                {detail.details || "—"}
              </p>
              {detail.ipAddress ? (
                <p>
                  <span className="text-muted-foreground">IP:</span>{" "}
                  {detail.ipAddress}
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
