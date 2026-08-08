"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { MASTER_CONFIGS, PAGE_SIZE, COLLECTIONS, INSTRUMENT_STATUS_LABELS } from "@/lib/constants";
import {
  createDocument,
  listDocumentsSafe,
  logActivity,
  logAudit,
  softDeleteDocument,
  updateDocument,
} from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { useCollection, useDebouncedValue, usePagination } from "@/hooks/use-firestore";
import { useSearchQueryParam } from "@/hooks/use-search-query";
import { exportToCsv, exportToExcel, exportToPdf } from "@/lib/export";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  PageShell,
  TableSkeleton,
} from "@/components/shared/states";
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import type { BaseEntity, MasterField, TestParameter } from "@/types";

type Row = BaseEntity & Record<string, unknown>;

const MASTER_FETCH_LIMIT = 5000;

function truncateText(value: string, max = 48) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function isValidCasNumber(value: string) {
  return /^\d{2,7}-\d{2}-\d$/.test(value.trim());
}

function emptyParameter(): TestParameter {
  return {
    id: crypto.randomUUID(),
    name: "",
    lowerLimit: null,
    upperLimit: null,
    targetValue: null,
  };
}

function isCalibrationOverdue(value: string) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function emptyForm(fields: MasterField[]) {
  const form: Record<string, string> = {};
  fields.forEach((f) => {
    form[f.key] = "";
  });
  return form;
}

export function MasterModulePage({ masterKey }: { masterKey: string }) {
  const config = MASTER_CONFIGS[masterKey];
  const { profile, hasPermission } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useCollection<Row>(
    config.collection,
    refreshKey,
    MASTER_FETCH_LIMIT
  );
  const [search, setSearch] = useState("");
  useSearchQueryParam(setSearch);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "active"
  );
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm(config.fields));
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [referenceData, setReferenceData] = useState<Record<string, Row[]>>({});
  const [parameters, setParameters] = useState<TestParameter[]>([]);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);

  const referenceCollections = useMemo(() => {
    const collections = [
      ...new Set(
        config.fields
          .map((field) => field.referenceCollection)
          .filter(Boolean) as string[]
      ),
    ];
    if (masterKey === "test-masters" && !collections.includes(COLLECTIONS.units)) {
      collections.push(COLLECTIONS.units);
    }
    if (
      masterKey === "specifications" &&
      !collections.includes(COLLECTIONS.testMasters)
    ) {
      collections.push(COLLECTIONS.testMasters);
    }
    return collections;
  }, [config.fields, masterKey]);

  useEffect(() => {
    if (!referenceCollections.length) {
      setReferenceData({});
      return;
    }
    let active = true;
    Promise.all(
      referenceCollections.map(async (collectionName) => {
        const rows = await listDocumentsSafe<Row>(collectionName, [], MASTER_FETCH_LIMIT);
        return [collectionName, rows] as const;
      })
    )
      .then((entries) => {
        if (active) setReferenceData(Object.fromEntries(entries));
      })
      .catch(() => {
        if (active) setReferenceData({});
      });
    return () => {
      active = false;
    };
  }, [referenceCollections, refreshKey]);

  const getFieldOptions = (field: MasterField) => {
    if (field.options?.length) return field.options;
    if (!field.referenceCollection) return [];
    const labelKey = field.referenceLabelKey || "name";
    return (referenceData[field.referenceCollection] || [])
      .filter((row) => row.isActive !== false)
      .map((row) => ({
        value: row.id,
        label: String(row[labelKey] || row.name || row.code || row.id),
      }));
  };

  const unitOptions = useMemo(
    () =>
      (referenceData[COLLECTIONS.units] || [])
        .filter((row) => row.isActive !== false)
        .map((row) => ({
          value: row.id,
          label: String(row.symbol || row.name || row.code || row.id),
        })),
    [referenceData]
  );

  const testMasterOptions = useMemo(
    () =>
      (referenceData[COLLECTIONS.testMasters] || [])
        .filter((row) => row.isActive !== false)
        .map((row) => ({
          value: row.id,
          label: String(row.name || row.code || row.id),
          code: String(row.code || ""),
        })),
    [referenceData]
  );

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return data.filter((row) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? row.isActive !== false : row.isActive === false);
      if (!matchesStatus) return false;
      if (!q) return true;
      const inFields = config.fields.some((field) =>
        String(row[field.key] ?? "")
          .toLowerCase()
          .includes(q)
      );
      const inColumns = config.columns.some((col) => {
        if (col.key === "parameterCount") {
          const count = (row.parameters as TestParameter[] | undefined)?.length ?? 0;
          return String(count).includes(q);
        }
        if (col.key === "testCount") {
          const count = (row.testIds as string[] | undefined)?.length ?? 0;
          return String(count).includes(q);
        }
        return String(row[col.key] ?? "")
          .toLowerCase()
          .includes(q);
      });
      const inParameters =
        masterKey === "test-masters" &&
        Array.isArray(row.parameters) &&
        (row.parameters as TestParameter[]).some(
          (param) =>
            String(param.name || "")
              .toLowerCase()
              .includes(q) ||
            String(param.unit || "")
              .toLowerCase()
              .includes(q)
        );
      return inFields || inColumns || inParameters;
    });
  }, [data, debounced, config.fields, config.columns, statusFilter, masterKey]);

  const { page, setPage, totalPages, pageItems, total } = usePagination(
    filtered,
    PAGE_SIZE
  );

  const canManage = hasPermission("manageMasters");
  const canExport = hasPermission("export");

  const hasCodeField = config.fields.some((field) => field.key === "code");

  const openCreate = () => {
    setEditing(null);
    const next = emptyForm(config.fields);
    if (masterKey === "instruments") {
      next.status = "available";
    }
    if (masterKey === "methods") {
      next.version = "1.0";
    }
    setForm(next);
    if (masterKey === "test-masters") {
      setParameters([emptyParameter()]);
    }
    if (masterKey === "specifications") {
      setSelectedTestIds([]);
    }
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    const next = emptyForm(config.fields);
    config.fields.forEach((field) => {
      next[field.key] = String(row[field.key] ?? "");
    });
    setForm(next);
    if (masterKey === "test-masters") {
      const existing = (row.parameters as TestParameter[] | undefined) || [];
      setParameters(
        existing.length ? existing.map((param) => ({ ...param })) : [emptyParameter()]
      );
    }
    if (masterKey === "specifications") {
      setSelectedTestIds(
        Array.isArray(row.testIds) ? (row.testIds as string[]).slice() : []
      );
    }
    setOpen(true);
  };

  const toggleTestId = (testId: string) => {
    setSelectedTestIds((prev) =>
      prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId]
    );
  };

  const updateParameter = (index: number, patch: Partial<TestParameter>) => {
    setParameters((prev) =>
      prev.map((param, idx) => (idx === index ? { ...param, ...patch } : param))
    );
  };

  const addParameter = () => {
    setParameters((prev) => [...prev, emptyParameter()]);
  };

  const removeParameter = (index: number) => {
    setParameters((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)
    );
  };

  const save = async () => {
    for (const field of config.fields) {
      const value = form[field.key]?.trim() || "";
      if (field.required && !value) {
        toast.error(`${field.label} is required`);
        return;
      }
      if (field.type === "email" && value && !isValidEmail(value)) {
        toast.error(`Enter a valid ${field.label.toLowerCase()}`);
        return;
      }
      if (field.type === "phone" && value && !isValidPhone(value)) {
        toast.error(`Enter a valid ${field.label.toLowerCase()}`);
        return;
      }
      if (field.key === "casNumber" && value && !isValidCasNumber(value)) {
        toast.error("Enter a valid CAS number (e.g. 7732-18-5)");
        return;
      }
      if (field.type === "number" && value && Number(value) < 0) {
        toast.error(`${field.label} cannot be negative`);
        return;
      }
      if (
        field.key === "retentionDays" &&
        value &&
        (!Number.isInteger(Number(value)) || Number(value) === 0)
      ) {
        toast.error("Retention days must be a whole number greater than 0");
        return;
      }
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      config.fields.forEach((field) => {
        const value = form[field.key];
        let normalized =
          field.type === "number"
            ? value === ""
              ? null
              : Number(value)
            : value.trim();
        if (field.type === "email" && typeof normalized === "string" && normalized) {
          normalized = normalized.toLowerCase();
        }
        payload[field.key] = normalized;
      });

      config.fields.forEach((field) => {
        if (field.referenceCollection && payload[field.key]) {
          const selected = (referenceData[field.referenceCollection] || []).find(
            (row) => row.id === payload[field.key]
          );
          const nameKey = field.key.replace(/Id$/, "Name");
          if (selected && nameKey !== field.key) {
            payload[nameKey] =
              selected.name || selected.code || selected.id || "";
          }
        }
        if (field.referenceCollection && !payload[field.key]) {
          payload[field.key] = undefined;
          const nameKey = field.key.replace(/Id$/, "Name");
          if (nameKey !== field.key) payload[nameKey] = undefined;
        }
      });

      if (masterKey === "test-masters") {
        const trimmed = parameters.map((param) => ({
          ...param,
          name: param.name.trim(),
        }));
        if (trimmed.some((param) => !param.name)) {
          toast.error("Each parameter must have a name");
          setSaving(false);
          return;
        }
        for (const param of trimmed) {
          if (
            param.lowerLimit != null &&
            param.upperLimit != null &&
            param.lowerLimit > param.upperLimit
          ) {
            toast.error(`Lower limit cannot exceed upper limit for "${param.name}"`);
            setSaving(false);
            return;
          }
        }
        payload.parameters = trimmed.map((param) => {
          const unitRow = param.unitId
            ? (referenceData[COLLECTIONS.units] || []).find((row) => row.id === param.unitId)
            : undefined;
          return {
            id: param.id || crypto.randomUUID(),
            name: param.name,
            unitId: param.unitId || undefined,
            unit: unitRow
              ? String(unitRow.symbol || unitRow.name || "")
              : param.unit || undefined,
            lowerLimit: param.lowerLimit ?? null,
            upperLimit: param.upperLimit ?? null,
            targetValue: param.targetValue ?? null,
          };
        });
      }

      if (masterKey === "instruments" && !payload.status) {
        payload.status = "available";
      }

      if (masterKey === "specifications") {
        payload.testIds = selectedTestIds;
      }

      if (hasCodeField && payload.code) {
        payload.code = String(payload.code).trim().toUpperCase();
        const duplicate = data.find(
          (row) =>
            row.id !== editing?.id &&
            String(row.code || "")
              .trim()
              .toUpperCase() === payload.code
        );
        if (duplicate) {
          toast.error(`${config.singular} code already exists`);
          setSaving(false);
          return;
        }
      }

      if (masterKey === "units" && payload.symbol) {
        payload.symbol = String(payload.symbol).trim();
        const duplicateSymbol = data.find(
          (row) =>
            row.id !== editing?.id &&
            String(row.symbol || "")
              .trim()
              .toLowerCase() === String(payload.symbol).toLowerCase()
        );
        if (duplicateSymbol) {
          toast.error("Unit symbol already exists");
          setSaving(false);
          return;
        }
      }

      payload.updatedBy = profile?.uid;
      if (!editing) {
        payload.createdBy = profile?.uid;
      }

      if (editing) {
        for (const field of config.fields) {
          const oldValue = String(editing[field.key] ?? "");
          const newValue = String(payload[field.key] ?? "");
          if (oldValue !== newValue) {
            await logAudit({
              entityType: config.collection,
              entityId: editing.id,
              entityLabel: String(editing.name || editing.code || editing.id),
              field: field.label,
              oldValue,
              newValue,
              userId: profile?.uid || "",
              userName: profile?.displayName || "User",
              action: "update",
              reason: "Master record update",
            });
          }
        }
        await updateDocument(config.collection, editing.id, payload);
        await logActivity({
          action: `Update ${config.singular}`,
          entityType: config.collection,
          entityId: editing.id,
          entityLabel: String(payload.name || payload.code || editing.id),
          userId: profile?.uid || "",
          userName: profile?.displayName || "User",
          userEmail: profile?.email,
        });
        toast.success(`${config.singular} updated`);
      } else {
        const id = await createDocument(config.collection, payload);
        await logAudit({
          entityType: config.collection,
          entityId: id,
          entityLabel: String(payload.name || payload.code || id),
          field: "record",
          oldValue: "",
          newValue: "created",
          userId: profile?.uid || "",
          userName: profile?.displayName || "User",
          action: "create",
        });
        await logActivity({
          action: `Create ${config.singular}`,
          entityType: config.collection,
          entityId: id,
          entityLabel: String(payload.name || payload.code || id),
          userId: profile?.uid || "",
          userName: profile?.displayName || "User",
          userEmail: profile?.email,
        });
        toast.success(`${config.singular} created`);
      }
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await softDeleteDocument(config.collection, deleteTarget.id);
      await logAudit({
        entityType: config.collection,
        entityId: deleteTarget.id,
        entityLabel: String(deleteTarget.name || deleteTarget.code || deleteTarget.id),
        field: "isActive",
        oldValue: "true",
        newValue: "false",
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        action: "delete",
      });
      await logActivity({
        action: `Archive ${config.singular}`,
        entityType: config.collection,
        entityId: deleteTarget.id,
        entityLabel: String(deleteTarget.name || deleteTarget.code || deleteTarget.id),
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      toast.success(`${config.singular} archived`);
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setDeleting(false);
    }
  };

  const restore = async (row: Row) => {
    setSaving(true);
    try {
      await updateDocument(config.collection, row.id, {
        isActive: true,
        updatedBy: profile?.uid,
      });
      await logActivity({
        action: `Restore ${config.singular}`,
        entityType: config.collection,
        entityId: row.id,
        entityLabel: String(row.name || row.code || row.id),
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      toast.success(`${config.singular} restored`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setSaving(false);
    }
  };

  const exportRows = filtered.map((row) => {
    const mapped: Record<string, unknown> = {};
    config.columns.forEach((col) => {
      if (col.key === "isActive") {
        mapped[col.key] = row.isActive === false ? "Inactive" : "Active";
      } else if (col.key === "parameterCount") {
        mapped[col.key] = (row.parameters as TestParameter[] | undefined)?.length ?? 0;
      } else if (col.key === "testCount") {
        mapped[col.key] = (row.testIds as string[] | undefined)?.length ?? 0;
      } else if (col.key === "status" && masterKey === "instruments") {
        mapped[col.key] =
          INSTRUMENT_STATUS_LABELS[
            String(row.status || "") as keyof typeof INSTRUMENT_STATUS_LABELS
          ] ||
          row.status ||
          "";
      } else {
        mapped[col.key] = row[col.key] ?? "";
      }
    });
    return mapped;
  });

  if (!config) {
    return (
      <PageShell>
        <ErrorState title="Unknown master module" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Masters" },
          { label: config.singular },
        ]}
        actions={
          <>
            {canExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 rounded-xl">
                    <Download className="mr-2 size-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      exportToCsv(config.collection, exportRows, config.columns)
                    }
                  >
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      exportToExcel(config.collection, exportRows, config.columns)
                    }
                  >
                    <FileSpreadsheet className="mr-2 size-4" />
                    Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      exportToPdf(config.title, exportRows, config.columns)
                    }
                  >
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canManage && (
              <Button className="h-10 rounded-xl px-4" onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                Add {config.singular}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${config.singular.toLowerCase()}...`}
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as "all" | "active" | "inactive")
          }
        >
          <SelectTrigger className="h-10 w-full rounded-xl sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{total} records</p>
      </div>

      {data.length >= MASTER_FETCH_LIMIT && (
        <p className="mb-4 text-sm text-muted-foreground">
          Showing the latest {MASTER_FETCH_LIMIT.toLocaleString()} records. Older entries
          may not appear.
        </p>
      )}

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState description={error} onRetry={() => setRefreshKey((k) => k + 1)} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={`No ${config.singular.toLowerCase()} records`}
          action={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                Add {config.singular}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card soft-shadow">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                <TableRow>
                  {config.columns.map((col) => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((row) => (
                  <TableRow key={row.id}>
                    {config.columns.map((col) => (
                      <TableCell key={col.key}>
                        {col.key === "isActive" ? (
                          <ActiveBadge active={row.isActive !== false} />
                        ) : col.key === "parameterCount" ? (
                          String((row.parameters as TestParameter[] | undefined)?.length ?? 0)
                        ) : col.key === "testCount" ? (
                          String((row.testIds as string[] | undefined)?.length ?? 0)
                        ) : col.key === "status" && masterKey === "instruments" ? (
                          row.status ? (
                            <StatusBadge status={String(row.status)} />
                          ) : (
                            "—"
                          )
                        ) : col.key === "calibrationDue" ? (
                          row[col.key] ? (
                            <span
                              className={cn(
                                isCalibrationOverdue(String(row[col.key])) &&
                                  "font-medium text-destructive"
                              )}
                            >
                              {formatDate(String(row[col.key]))}
                              {isCalibrationOverdue(String(row[col.key]))
                                ? " · Overdue"
                                : ""}
                            </span>
                          ) : (
                            "—"
                          )
                        ) : col.key.toLowerCase().includes("date") ? (
                          formatDate(String(row[col.key] || ""))
                        ) : col.key === "description" ? (
                          truncateText(String(row[col.key] ?? "—"))
                        ) : (
                          String(row[col.key] ?? "—")
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="Actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canManage && row.isActive !== false && (
                            <DropdownMenuItem onClick={() => openEdit(row)}>
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canManage && row.isActive !== false && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Archive
                            </DropdownMenuItem>
                          )}
                          {canManage && row.isActive === false && (
                            <DropdownMenuItem onClick={() => restore(row)}>
                              Restore
                            </DropdownMenuItem>
                          )}
                          {!canManage && (
                            <DropdownMenuItem disabled>View only</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {total} records · Page {page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-y-auto",
            masterKey === "test-masters" || masterKey === "specifications"
              ? "sm:max-w-3xl"
              : "sm:max-w-lg"
          )}
        >
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${config.singular}` : `Add ${config.singular}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {config.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required ? " *" : ""}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={field.key}
                    value={form[field.key]}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="min-h-24 rounded-xl"
                  />
                ) : field.type === "select" ? (
                  <Select
                    value={form[field.key] || "__none__"}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        [field.key]: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder={`Select ${field.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {!field.required && (
                        <SelectItem value="__none__">None</SelectItem>
                      )}
                      {getFieldOptions(field).length === 0 ? (
                        !field.required ? null : (
                          <SelectItem value="__empty__" disabled>
                            No options available
                          </SelectItem>
                        )
                      ) : (
                        getFieldOptions(field).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={field.key}
                    type={
                      field.type === "number"
                        ? "number"
                        : field.type === "date"
                          ? "date"
                          : field.type === "email"
                            ? "email"
                            : field.type === "phone"
                              ? "tel"
                              : "text"
                    }
                    value={form[field.key]}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="h-10 rounded-xl"
                  />
                )}
              </div>
            ))}
            {masterKey === "test-masters" && (
              <div className="space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <Label>Test Parameters</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addParameter}>
                    <Plus className="mr-1 size-3.5" />
                    Add Parameter
                  </Button>
                </div>
                <div className="space-y-3">
                  {parameters.map((param, index) => (
                    <div
                      key={param.id}
                      className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2"
                    >
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Parameter Name *</Label>
                        <Input
                          value={param.name}
                          onChange={(e) =>
                            updateParameter(index, { name: e.target.value })
                          }
                          placeholder="e.g. Assay, Moisture, pH"
                          className="h-9 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit</Label>
                        <Select
                          value={param.unitId || "__none__"}
                          onValueChange={(value) =>
                            updateParameter(index, {
                              unitId: value === "__none__" ? undefined : value,
                            })
                          }
                        >
                          <SelectTrigger className="h-9 rounded-lg">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {unitOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Target Value</Label>
                        <Input
                          type="number"
                          value={param.targetValue ?? ""}
                          onChange={(e) =>
                            updateParameter(index, {
                              targetValue:
                                e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="h-9 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Lower Limit</Label>
                        <Input
                          type="number"
                          value={param.lowerLimit ?? ""}
                          onChange={(e) =>
                            updateParameter(index, {
                              lowerLimit:
                                e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="h-9 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Upper Limit</Label>
                        <Input
                          type="number"
                          value={param.upperLimit ?? ""}
                          onChange={(e) =>
                            updateParameter(index, {
                              upperLimit:
                                e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="h-9 rounded-lg"
                        />
                      </div>
                      {parameters.length > 1 && (
                        <div className="flex items-end sm:col-span-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeParameter(index)}
                          >
                            <Trash2 className="mr-1 size-3.5" />
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {masterKey === "specifications" && (
              <div className="space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label>Linked Tests</Label>
                    <p className="text-xs text-muted-foreground">
                      Select analytical tests covered by this specification.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {selectedTestIds.length} selected
                  </span>
                </div>
                {testMasterOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active tests available. Create tests in Test Master first.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border bg-muted/20 p-3">
                    {testMasterOptions.map((opt) => {
                      const checked = selectedTestIds.includes(opt.value);
                      return (
                        <label
                          key={opt.value}
                          className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-background/80"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleTestId(opt.value)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium leading-tight">
                              {opt.label}
                            </span>
                            {opt.code ? (
                              <span className="text-xs text-muted-foreground">
                                {opt.code}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {editing && (
              <p className="text-xs text-muted-foreground">
                Last updated {formatDateTime(editing.updatedAt)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="rounded-xl">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Archive ${config.singular}?`}
        description="This hides the record from active lists while keeping audit history."
        confirmLabel="Archive"
        destructive
        loading={deleting}
        onConfirm={remove}
      />
    </PageShell>
  );
}
