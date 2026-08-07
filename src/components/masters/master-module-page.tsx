"use client";

import { useMemo, useState } from "react";
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
import { MASTER_CONFIGS, PAGE_SIZE } from "@/lib/constants";
import {
  createDocument,
  hardDeleteDocument,
  logActivity,
  logAudit,
  updateDocument,
} from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { useCollection, useDebouncedValue, usePagination } from "@/hooks/use-firestore";
import { exportToCsv, exportToExcel, exportToPdf } from "@/lib/export";
import { formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  PageShell,
  TableSkeleton,
} from "@/components/shared/states";
import { ActiveBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
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
import type { BaseEntity, MasterField } from "@/types";

type Row = BaseEntity & Record<string, unknown>;

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
  const { data, loading, error } = useCollection<Row>(config.collection, refreshKey);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm(config.fields));
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      config.fields.some((field) =>
        String(row[field.key] ?? "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [data, debounced, config.fields]);

  const { page, setPage, totalPages, pageItems, total } = usePagination(
    filtered,
    PAGE_SIZE
  );

  const canManage = hasPermission("manageMasters");

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(config.fields));
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    const next = emptyForm(config.fields);
    config.fields.forEach((field) => {
      next[field.key] = String(row[field.key] ?? "");
    });
    setForm(next);
    setOpen(true);
  };

  const save = async () => {
    for (const field of config.fields) {
      if (field.required && !form[field.key]?.trim()) {
        toast.error(`${field.label} is required`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      config.fields.forEach((field) => {
        const value = form[field.key];
        payload[field.key] =
          field.type === "number"
            ? value === ""
              ? null
              : Number(value)
            : value.trim();
      });
      payload.createdBy = profile?.uid;
      payload.updatedBy = profile?.uid;

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
        if (masterKey === "test-masters") {
          payload.parameters = [];
        }
        if (masterKey === "specifications") {
          payload.testIds = [];
        }
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
      await hardDeleteDocument(config.collection, deleteTarget.id);
      await logAudit({
        entityType: config.collection,
        entityId: deleteTarget.id,
        entityLabel: String(deleteTarget.name || deleteTarget.code || deleteTarget.id),
        field: "record",
        oldValue: "exists",
        newValue: "deleted",
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        action: "delete",
      });
      await logActivity({
        action: `Delete ${config.singular}`,
        entityType: config.collection,
        entityId: deleteTarget.id,
        entityLabel: String(deleteTarget.name || deleteTarget.code || deleteTarget.id),
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      toast.success(`${config.singular} deleted`);
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const exportRows = filtered.map((row) => {
    const mapped: Record<string, unknown> = {};
    config.columns.forEach((col) => {
      if (col.key === "isActive") {
        mapped[col.key] = row.isActive === false ? "Inactive" : "Active";
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
        <p className="text-sm text-muted-foreground">{total} records</p>
      </div>

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
                        ) : col.key.toLowerCase().includes("date") ? (
                          formatDate(String(row[col.key] || ""))
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
                          {canManage && (
                            <DropdownMenuItem onClick={() => openEdit(row)}>
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canManage && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
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
              Page {page} of {totalPages}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
                    value={form[field.key]}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, [field.key]: value }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder={`Select ${field.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options || []).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
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
        title={`Delete ${config.singular}?`}
        description="This action cannot be undone. Related historical audit entries will remain."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={remove}
      />
    </PageShell>
  );
}
