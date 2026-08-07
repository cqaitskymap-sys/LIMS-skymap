"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, MoreHorizontal, Plus, RotateCcw, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { COLLECTIONS, PAGE_SIZE } from "@/lib/constants";
import {
  createDocument,
  getNextSequence,
  logActivity,
  logAudit,
  updateDocument,
} from "@/lib/firebase/firestore";
import { formatDateTime } from "@/lib/utils";
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
  LabTest,
  Sample,
  TestMaster,
  TestResultParameter,
} from "@/types";

export default function TestingPage() {
  const params = useSearchParams();
  const { profile, hasPermission } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: tests, loading, error } = useCollection<LabTest>(
    COLLECTIONS.tests,
    refreshKey
  );
  const { data: samples } = useCollection<Sample>(COLLECTIONS.samples);
  const { data: testMasters } = useCollection<TestMaster>(COLLECTIONS.testMasters);
  const { data: users } = useCollection<AppUser>(COLLECTIONS.users);

  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState<LabTest | null>(null);
  const [sampleId, setSampleId] = useState(params.get("sample") || "");
  const [testMasterId, setTestMasterId] = useState("");
  const [analystId, setAnalystId] = useState("");
  const [parameters, setParameters] = useState<TestResultParameter[]>([]);
  const [signatureReason, setSignatureReason] = useState("");
  const [saving, setSaving] = useState(false);

  const analysts = users.filter((u) =>
    ["analyst", "qc", "admin"].includes(u.role)
  );

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return tests.filter(
      (t) =>
        !q ||
        t.testNumber.toLowerCase().includes(q) ||
        t.sampleNumber.toLowerCase().includes(q) ||
        t.testName.toLowerCase().includes(q)
    );
  }, [tests, debounced]);

  const { page, setPage, totalPages, pageItems } = usePagination(
    filtered,
    PAGE_SIZE
  );

  const createTest = async () => {
    if (!sampleId || !testMasterId) {
      toast.error("Select sample and test");
      return;
    }
    setSaving(true);
    try {
      const sample = samples.find((s) => s.id === sampleId);
      const master = testMasters.find((t) => t.id === testMasterId);
      const analyst = analysts.find((a) => a.id === analystId);
      if (!sample || !master) throw new Error("Invalid selection");
      let testNumber = `TST-${Date.now()}`;
      try {
        testNumber = await getNextSequence("tests", "TST");
      } catch {
        // ignore
      }
      const paramsList: TestResultParameter[] = (master.parameters || []).map(
        (p) => ({
          parameterId: p.id,
          name: p.name,
          unit: p.unit,
          lowerLimit: p.lowerLimit,
          upperLimit: p.upperLimit,
          observedValue: null,
          resultStatus: "pending",
        })
      );
      const id = await createDocument(COLLECTIONS.tests, {
        testNumber,
        sampleId: sample.id,
        sampleNumber: sample.sampleNumber,
        testMasterId: master.id,
        testName: master.name,
        analystId: analyst?.id,
        analystName: analyst?.displayName,
        status: "pending",
        resultStatus: "pending",
        parameters: paramsList,
        retestCount: 0,
        createdBy: profile?.uid,
        updatedBy: profile?.uid,
      });
      await updateDocument(COLLECTIONS.samples, sample.id, {
        status: "in_testing",
      });
      await logActivity({
        action: "Create Test",
        entityType: "tests",
        entityId: id,
        entityLabel: testNumber,
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      toast.success("Test created");
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setSaving(false);
    }
  };

  const openResults = (test: LabTest) => {
    setResultOpen(test);
    setParameters(test.parameters || []);
    setSignatureReason("");
  };

  const evaluate = (param: TestResultParameter): TestResultParameter => {
    const value = param.observedValue;
    if (value === null || value === undefined || value === "") {
      return { ...param, resultStatus: "pending" };
    }
    const num = Number(value);
    if (Number.isNaN(num)) return { ...param, resultStatus: "pass" };
    const lowOk =
      param.lowerLimit === null ||
      param.lowerLimit === undefined ||
      num >= Number(param.lowerLimit);
    const highOk =
      param.upperLimit === null ||
      param.upperLimit === undefined ||
      num <= Number(param.upperLimit);
    return { ...param, resultStatus: lowOk && highOk ? "pass" : "fail" };
  };

  const saveResults = async (nextStatus: LabTest["status"]) => {
    if (!resultOpen) return;
    if (
      (nextStatus === "approved" || nextStatus === "released") &&
      !signatureReason.trim()
    ) {
      toast.error("Electronic signature reason is required");
      return;
    }
    setSaving(true);
    try {
      const evaluated = parameters.map(evaluate);
      const hasFail = evaluated.some((p) => p.resultStatus === "fail");
      const payload: Record<string, unknown> = {
        parameters: evaluated,
        resultStatus: hasFail ? "fail" : "pass",
        status: nextStatus,
        updatedBy: profile?.uid,
      };
      if (nextStatus === "in_review") {
        payload.completedAt = new Date().toISOString();
        payload.reviewerId = profile?.uid;
        payload.reviewerName = profile?.displayName;
      }
      if (nextStatus === "approved" || nextStatus === "released") {
        payload.approvedAt = new Date().toISOString();
        payload.qaId = profile?.uid;
        payload.qaName = profile?.displayName;
        payload.electronicSignature = {
          signedBy: profile?.uid,
          signedByName: profile?.displayName,
          signedAt: new Date().toISOString(),
          reason: signatureReason,
        };
      }
      await updateDocument(COLLECTIONS.tests, resultOpen.id, payload);
      await logAudit({
        entityType: "tests",
        entityId: resultOpen.id,
        entityLabel: resultOpen.testNumber,
        field: "status",
        oldValue: resultOpen.status,
        newValue: nextStatus,
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        action:
          nextStatus === "approved"
            ? "approve"
            : nextStatus === "rejected"
              ? "reject"
              : nextStatus === "released"
                ? "release"
                : "update",
        reason: signatureReason || "Workflow update",
      });
      await logActivity({
        action: `Test ${nextStatus}`,
        entityType: "tests",
        entityId: resultOpen.id,
        entityLabel: resultOpen.testNumber,
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      if (nextStatus === "approved" || nextStatus === "released") {
        await updateDocument(COLLECTIONS.samples, resultOpen.sampleId, {
          status: nextStatus === "released" ? "released" : "approved",
        });
      }
      toast.success("Test updated");
      setResultOpen(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const retest = async (test: LabTest) => {
    await updateDocument(COLLECTIONS.tests, test.id, {
      status: "pending",
      resultStatus: "retest",
      retestCount: (test.retestCount || 0) + 1,
      parameters: (test.parameters || []).map((p) => ({
        ...p,
        observedValue: null,
        resultStatus: "pending",
      })),
    });
    await logActivity({
      action: "Retest",
      entityType: "tests",
      entityId: test.id,
      entityLabel: test.testNumber,
      userId: profile?.uid || "",
      userName: profile?.displayName || "User",
      userEmail: profile?.email,
    });
    toast.success("Retest initiated");
    setRefreshKey((k) => k + 1);
  };

  return (
    <PageShell>
      <PageHeader
        title="Testing Module"
        description="Assign tests, record results, review, and approve with e-signature."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Testing" },
        ]}
        actions={
          hasPermission("recordResults") || hasPermission("manageSamples") ? (
            <Button className="h-10 rounded-xl" onClick={() => setOpen(true)}>
              <Plus className="mr-2 size-4" />
              Create Test
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tests..."
          className="h-10 rounded-xl pl-9"
        />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState description={error} onRetry={() => setRefreshKey((k) => k + 1)} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No tests found" />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card soft-shadow">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test #</TableHead>
                  <TableHead>Sample</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Analyst</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium">{test.testNumber}</TableCell>
                    <TableCell>{test.sampleNumber}</TableCell>
                    <TableCell>{test.testName}</TableCell>
                    <TableCell>{test.analystName || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={test.resultStatus} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={test.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openResults(test)}>
                            Record / Review
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => retest(test)}>
                            <RotateCcw className="mr-2 size-4" />
                            Retest
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Test</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sample</Label>
              <Select value={sampleId} onValueChange={setSampleId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select sample" />
                </SelectTrigger>
                <SelectContent>
                  {samples.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.sampleNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Test</Label>
              <Select value={testMasterId} onValueChange={setTestMasterId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select test" />
                </SelectTrigger>
                <SelectContent>
                  {testMasters.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Analyst</Label>
              <Select value={analystId} onValueChange={setAnalystId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Assign analyst" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTest} disabled={saving}>
              {saving ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resultOpen} onOpenChange={(v) => !v && setResultOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {resultOpen?.testNumber} · {resultOpen?.testName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {parameters.map((param, index) => (
              <div key={param.parameterId || index} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium">{param.name}</p>
                  <StatusBadge status={evaluate(param).resultStatus} />
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Limits: {param.lowerLimit ?? "—"} – {param.upperLimit ?? "—"}{" "}
                  {param.unit || ""}
                </p>
                <Input
                  className="rounded-xl"
                  value={param.observedValue?.toString() ?? ""}
                  disabled={!hasPermission("recordResults")}
                  onChange={(e) => {
                    const next = [...parameters];
                    next[index] = {
                      ...param,
                      observedValue: e.target.value,
                    };
                    setParameters(next);
                  }}
                  placeholder="Observed value"
                />
              </div>
            ))}
            {(hasPermission("approve") || hasPermission("review")) && (
              <div className="space-y-2">
                <Label>Electronic Signature Reason</Label>
                <Textarea
                  className="rounded-xl"
                  value={signatureReason}
                  onChange={(e) => setSignatureReason(e.target.value)}
                  placeholder="I confirm the results are accurate..."
                />
              </div>
            )}
            {resultOpen?.electronicSignature && (
              <p className="text-xs text-muted-foreground">
                Signed by {resultOpen.electronicSignature.signedByName} on{" "}
                {formatDateTime(resultOpen.electronicSignature.signedAt)}
              </p>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {hasPermission("recordResults") && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => saveResults("in_review")}
              >
                Submit for Review
              </Button>
            )}
            {hasPermission("review") && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => saveResults("in_review")}
              >
                Mark Reviewed
              </Button>
            )}
            {hasPermission("approve") && (
              <Button disabled={saving} onClick={() => saveResults("approved")}>
                <Check className="mr-2 size-4" />
                Approve
              </Button>
            )}
            {hasPermission("release") && (
              <Button
                disabled={saving}
                onClick={() => saveResults("released")}
              >
                Release
              </Button>
            )}
            {hasPermission("approve") && (
              <Button
                variant="destructive"
                disabled={saving}
                onClick={() => saveResults("rejected")}
              >
                Reject
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
