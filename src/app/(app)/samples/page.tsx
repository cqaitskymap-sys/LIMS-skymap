"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import QRCode from "qrcode";
import Barcode from "react-barcode";
import {
  Download,
  Eye,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  COLLECTIONS,
  PAGE_SIZE,
  PRIORITY_LABELS,
  SAMPLE_STATUS_LABELS,
} from "@/lib/constants";
import {
  createDocument,
  getNextSequence,
  hardDeleteDocument,
  logActivity,
  logAudit,
  uploadFile,
} from "@/lib/firebase/firestore";
import { generateSampleNumber, formatDate } from "@/lib/utils";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FileUpload } from "@/components/shared/file-upload";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  AppUser,
  Customer,
  Product,
  Sample,
  SampleStatus,
  Priority,
  SampleType,
} from "@/types";

const schema = z.object({
  productId: z.string().optional(),
  customerId: z.string().optional(),
  sampleTypeId: z.string().optional(),
  batchNumber: z.string().optional(),
  lotNumber: z.string().optional(),
  quantity: z.string().optional(),
  receivedDate: z.string().min(1, "Received date is required"),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  status: z.enum([
    "received",
    "pending",
    "in_testing",
    "in_review",
    "approved",
    "rejected",
    "cancelled",
    "released",
  ]),
  assignedAnalystId: z.string().optional(),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function SamplesPage() {
  const { profile, hasPermission } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useCollection<Sample>(
    COLLECTIONS.samples,
    refreshKey
  );
  const { data: products } = useCollection<Product>(COLLECTIONS.products);
  const { data: customers } = useCollection<Customer>(COLLECTIONS.customers);
  const { data: sampleTypes } = useCollection<SampleType>(COLLECTIONS.sampleTypes);
  const { data: users } = useCollection<AppUser>(COLLECTIONS.users);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Sample | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Sample | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      receivedDate: new Date().toISOString().slice(0, 10),
      priority: "normal",
      status: "received",
    },
  });

  const analysts = useMemo(
    () => users.filter((u) => u.isActive !== false && ["analyst", "qc", "admin"].includes(u.role)),
    [users]
  );

  const filtered = useMemo(() => {
    return data.filter((sample) => {
      const q = debounced.trim().toLowerCase();
      const matchesSearch =
        !q ||
        sample.sampleNumber.toLowerCase().includes(q) ||
        (sample.productName || "").toLowerCase().includes(q) ||
        (sample.batchNumber || "").toLowerCase().includes(q) ||
        (sample.assignedAnalystName || "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || sample.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || sample.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [data, debounced, statusFilter, priorityFilter]);

  const { page, setPage, totalPages, pageItems, total } = usePagination(
    filtered,
    PAGE_SIZE
  );

  useEffect(() => {
    if (!detail) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(detail.barcode || detail.sampleNumber, {
      width: 180,
      margin: 1,
    }).then(setQrDataUrl);
  }, [detail]);

  const openCreate = () => {
    form.reset({
      receivedDate: new Date().toISOString().slice(0, 10),
      priority: "normal",
      status: "received",
      productId: "",
      customerId: "",
      sampleTypeId: "",
      batchNumber: "",
      lotNumber: "",
      quantity: "",
      dueDate: "",
      assignedAnalystId: "",
      remarks: "",
    });
    setPendingFiles([]);
    setOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const product = products.find((p) => p.id === values.productId);
      const customer = customers.find((c) => c.id === values.customerId);
      const analyst = analysts.find((a) => a.id === values.assignedAnalystId);
      let sampleNumber = generateSampleNumber();
      try {
        sampleNumber = await getNextSequence("samples", "SMP");
      } catch {
        // fallback local generator if counters unavailable
      }
      const barcode = sampleNumber.replace(/-/g, "");
      const attachments = [];
      for (const file of pendingFiles) {
        const path = `samples/${sampleNumber}/${Date.now()}-${file.name}`;
        const uploaded = await uploadFile(path, file);
        attachments.push({
          id: `${Date.now()}-${file.name}`,
          name: file.name,
          url: uploaded.url,
          contentType: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: profile?.uid,
        });
      }

      const payload: Omit<Sample, "id"> = {
        sampleNumber,
        barcode,
        productId: values.productId || undefined,
        productName: product?.name,
        customerId: values.customerId || undefined,
        customerName: customer?.name,
        sampleTypeId: values.sampleTypeId || undefined,
        batchNumber: values.batchNumber || undefined,
        lotNumber: values.lotNumber || undefined,
        quantity: values.quantity ? Number(values.quantity) : undefined,
        receivedDate: values.receivedDate,
        dueDate: values.dueDate || undefined,
        priority: values.priority as Priority,
        status: values.status as SampleStatus,
        assignedAnalystId: values.assignedAnalystId || undefined,
        assignedAnalystName: analyst?.displayName,
        remarks: values.remarks || undefined,
        attachments,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: profile?.uid,
        updatedBy: profile?.uid,
        isActive: true,
      };

      const id = await createDocument(COLLECTIONS.samples, payload);
      await logActivity({
        action: "Create Sample",
        entityType: "samples",
        entityId: id,
        entityLabel: sampleNumber,
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      await logAudit({
        entityType: "samples",
        entityId: id,
        entityLabel: sampleNumber,
        field: "record",
        oldValue: "",
        newValue: "created",
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        action: "create",
      });
      toast.success(`Sample ${sampleNumber} created`);
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create sample");
    } finally {
      setSaving(false);
    }
  });

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await hardDeleteDocument(COLLECTIONS.samples, deleteTarget.id);
      await logActivity({
        action: "Delete Sample",
        entityType: "samples",
        entityId: deleteTarget.id,
        entityLabel: deleteTarget.sampleNumber,
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      toast.success("Sample deleted");
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const exportRows = filtered.map((s) => ({
    sampleNumber: s.sampleNumber,
    product: s.productName || "",
    customer: s.customerName || "",
    status: SAMPLE_STATUS_LABELS[s.status],
    priority: PRIORITY_LABELS[s.priority],
    analyst: s.assignedAnalystName || "",
    receivedDate: s.receivedDate,
  }));
  const exportCols = [
    { key: "sampleNumber", label: "Sample #" },
    { key: "product", label: "Product" },
    { key: "customer", label: "Customer" },
    { key: "status", label: "Status" },
    { key: "priority", label: "Priority" },
    { key: "analyst", label: "Analyst" },
    { key: "receivedDate", label: "Received" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Sample Management"
        description="Register, track, and assign laboratory samples."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Samples" },
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
                  onClick={() => exportToCsv("samples", exportRows, exportCols)}
                >
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportToExcel("samples", exportRows, exportCols)}
                >
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    exportToPdf("Samples Report", exportRows, exportCols)
                  }
                >
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {hasPermission("manageSamples") && (
              <Button className="h-10 rounded-xl" onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                Add Sample
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sample #, product, batch, analyst..."
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(SAMPLE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState description={error} onRetry={() => setRefreshKey((k) => k + 1)} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No samples yet"
          action={
            hasPermission("manageSamples") ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                Add Sample
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card soft-shadow">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur">
                <TableRow>
                  <TableHead>Sample #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Analyst</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((sample) => (
                  <TableRow key={sample.id}>
                    <TableCell className="font-medium">
                      {sample.sampleNumber}
                    </TableCell>
                    <TableCell>{sample.productName || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={sample.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={sample.priority} />
                    </TableCell>
                    <TableCell>{sample.assignedAnalystName || "—"}</TableCell>
                    <TableCell>{formatDate(sample.receivedDate)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetail(sample)}>
                            <Eye className="mr-2 size-4" />
                            Details
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/testing?sample=${sample.id}`}>
                              Create Test
                            </Link>
                          </DropdownMenuItem>
                          {hasPermission("manageSamples") && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(sample)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
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
              {total} samples · Page {page}/{totalPages}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Register Sample</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={form.watch("productId") || ""}
                onValueChange={(v) => form.setValue("productId", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select
                value={form.watch("customerId") || ""}
                onValueChange={(v) => form.setValue("customerId", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sample Type</Label>
              <Select
                value={form.watch("sampleTypeId") || ""}
                onValueChange={(v) => form.setValue("sampleTypeId", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {sampleTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign Analyst</Label>
              <Select
                value={form.watch("assignedAnalystId") || ""}
                onValueChange={(v) => form.setValue("assignedAnalystId", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select analyst" />
                </SelectTrigger>
                <SelectContent>
                  {analysts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Batch Number</Label>
              <Input className="rounded-xl" {...form.register("batchNumber")} />
            </div>
            <div className="space-y-2">
              <Label>Lot Number</Label>
              <Input className="rounded-xl" {...form.register("lotNumber")} />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                className="rounded-xl"
                {...form.register("quantity")}
              />
            </div>
            <div className="space-y-2">
              <Label>Received Date *</Label>
              <Input
                type="date"
                className="rounded-xl"
                {...form.register("receivedDate")}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" className="rounded-xl" {...form.register("dueDate")} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.watch("priority")}
                onValueChange={(v) =>
                  form.setValue("priority", v as FormValues["priority"])
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Remarks</Label>
              <Textarea className="rounded-xl" {...form.register("remarks")} />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-2 block">Attachments</Label>
              <FileUpload
                onFiles={(files) =>
                  setPendingFiles((prev) => [...prev, ...files])
                }
                files={pendingFiles.map((f, i) => ({
                  id: `${f.name}-${i}`,
                  name: f.name,
                  size: f.size,
                }))}
                onRemove={(id) =>
                  setPendingFiles((prev) =>
                    prev.filter((f, i) => `${f.name}-${i}` !== id)
                  )
                }
              />
            </div>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="rounded-xl">
                {saving ? "Saving..." : "Create Sample"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.sampleNumber}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Product:</span>{" "}
                  {detail.productName || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Customer:</span>{" "}
                  {detail.customerName || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Batch:</span>{" "}
                  {detail.batchNumber || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <StatusBadge status={detail.status} />
                </p>
                <p>
                  <span className="text-muted-foreground">Priority:</span>{" "}
                  <StatusBadge status={detail.priority} />
                </p>
                <p>
                  <span className="text-muted-foreground">Analyst:</span>{" "}
                  {detail.assignedAnalystName || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Remarks:</span>{" "}
                  {detail.remarks || "—"}
                </p>
              </div>
              <div className="flex flex-col items-center gap-4 rounded-2xl border bg-muted/20 p-4">
                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="Sample QR" className="rounded-lg" />
                )}
                <Barcode
                  value={detail.barcode || detail.sampleNumber}
                  height={48}
                  width={1.4}
                  fontSize={12}
                  displayValue
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete sample?"
        description="This permanently removes the sample record."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={remove}
      />
    </PageShell>
  );
}
