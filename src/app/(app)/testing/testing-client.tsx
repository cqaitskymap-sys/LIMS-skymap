"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  notifyTestAssigned,
  notifyTestDecision,
  notifyTestReviewRequired,
} from "@/lib/notifications";
import { formatDateTime } from "@/lib/utils";
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
  ApprovalStatus,
  LabTest,
  Sample,
  TestMaster,
  TestResultParameter,
} from "@/types";

const TEST_FETCH_LIMIT = 5000;
const TESTABLE_SAMPLE_STATUSES = ["received", "pending", "in_testing"];

function allParametersFilled(params: TestResultParameter[]) {
  return params.every(
    (param) =>
      param.observedValue !== null &&
      param.observedValue !== undefined &&
      String(param.observedValue).trim() !== ""
  );
}

function evaluateParameter(param: TestResultParameter): TestResultParameter {
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
}

export default function TestingPage() {
  const params = useSearchParams();
  const { profile, hasPermission } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: tests, loading, error } = useCollection<LabTest>(
    COLLECTIONS.tests,
    refreshKey,
    TEST_FETCH_LIMIT
  );
  const { data: samples } = useCollection<Sample>(COLLECTIONS.samples);
  const { data: testMasters } = useCollection<TestMaster>(COLLECTIONS.testMasters);
  const { data: users } = useCollection<AppUser>(COLLECTIONS.users);

  const [search, setSearch] = useState("");
  useSearchQueryParam(setSearch);
  const [statusFilter, setStatusFilter] = useState("all");
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState<LabTest | null>(null);
  const [sampleId, setSampleId] = useState(params.get("sample") || "");
  const [testMasterId, setTestMasterId] = useState("");
  const [analystId, setAnalystId] = useState("");
  const [parameters, setParameters] = useState<TestResultParameter[]>([]);
  const [signatureReason, setSignatureReason] = useState("");
  const [saving, setSaving] = useState(false);

  const activeTests = useMemo(
    () => tests.filter((test) => test.isActive !== false),
    [tests]
  );

  const eligibleSamples = useMemo(
    () =>
      samples.filter(
        (sample) =>
          sample.isActive !== false &&
          TESTABLE_SAMPLE_STATUSES.includes(sample.status)
      ),
    [samples]
  );

  const activeTestMasters = useMemo(
    () => testMasters.filter((master) => master.isActive !== false),
    [testMasters]
  );

  const analysts = useMemo(
    () =>
      users.filter(
        (user) =>
          user.isActive !== false &&
          ["analyst", "qc", "admin"].includes(user.role)
      ),
    [users]
  );

  useEffect(() => {
    const linkedSample = params.get("sample");
    if (!linkedSample) return;
    setSampleId(linkedSample);
    if (hasPermission("recordResults") || hasPermission("manageSamples")) {
      setOpen(true);
    }
  }, [params, hasPermission]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return activeTests.filter((test) => {
      const matchesSearch =
        !q ||
        test.testNumber.toLowerCase().includes(q) ||
        test.sampleNumber.toLowerCase().includes(q) ||
        test.testName.toLowerCase().includes(q) ||
        (test.analystName || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || test.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [activeTests, debounced, statusFilter]);

  const { page, setPage, totalPages, pageItems, total } = usePagination(
    filtered,
    PAGE_SIZE
  );

  const resolveAnalystUid = (analystRef?: string) => {
    if (!analystRef) return undefined;
    return users.find((user) => user.id === analystRef || user.uid === analystRef)?.uid;
  };

  const createTest = async () => {
    if (!sampleId || !testMasterId) {
      toast.error("Select sample and test");
      return;
    }
    setSaving(true);
    try {
      const sample = eligibleSamples.find((item) => item.id === sampleId);
      const master = activeTestMasters.find((item) => item.id === testMasterId);
      const analyst = analysts.find((item) => item.id === analystId);
      if (!sample || !master) throw new Error("Invalid selection");
      let testNumber = `TST-${Date.now()}`;
      try {
        testNumber = await getNextSequence("tests", "TST");
      } catch {
        // fallback local generator if counters unavailable
      }
      const paramsList: TestResultParameter[] = (master.parameters || []).map(
        (param) => ({
          parameterId: param.id,
          name: param.name,
          unit: param.unit,
          lowerLimit: param.lowerLimit,
          upperLimit: param.upperLimit,
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
      if (analyst?.uid) {
        await notifyTestAssigned(analyst.uid, testNumber);
      }
      toast.success("Test created");
      setOpen(false);
      setTestMasterId("");
      setAnalystId("");
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

  const saveDraft = async () => {
    if (!resultOpen) return;
    setSaving(true);
    try {
      const evaluated = parameters.map(evaluateParameter);
      await updateDocument(COLLECTIONS.tests, resultOpen.id, {
        parameters: evaluated,
        resultStatus: evaluated.some((param) => param.resultStatus === "fail")
          ? "fail"
          : evaluated.every((param) => param.resultStatus === "pending")
            ? "pending"
            : "pass",
        startedAt: resultOpen.startedAt || new Date().toISOString(),
        updatedBy: profile?.uid,
      });
      toast.success("Results saved");
      setResultOpen(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    if (!resultOpen) return;
    if (!allParametersFilled(parameters)) {
      toast.error("Enter observed values for all parameters before submitting");
      return;
    }
    setSaving(true);
    try {
      const evaluated = parameters.map(evaluateParameter);
      await updateDocument(COLLECTIONS.tests, resultOpen.id, {
        parameters: evaluated,
        resultStatus: evaluated.some((param) => param.resultStatus === "fail")
          ? "fail"
          : "pass",
        status: "in_review",
        startedAt: resultOpen.startedAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
        updatedBy: profile?.uid,
      });
      await logAudit({
        entityType: "tests",
        entityId: resultOpen.id,
        entityLabel: resultOpen.testNumber,
        field: "status",
        oldValue: resultOpen.status,
        newValue: "in_review",
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        action: "update",
        reason: "Submitted for review",
      });
      await logActivity({
        action: "Submit Test for Review",
        entityType: "tests",
        entityId: resultOpen.id,
        entityLabel: resultOpen.testNumber,
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      await notifyTestReviewRequired(resultOpen.testNumber);
      toast.success("Submitted for review");
      setResultOpen(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSaving(false);
    }
  };

  const completeReview = async () => {
    if (!resultOpen) return;
    if (resultOpen.status !== "in_review") {
      toast.error("Only tests in review can be marked as reviewed");
      return;
    }
    setSaving(true);
    try {
      await updateDocument(COLLECTIONS.tests, resultOpen.id, {
        reviewedAt: new Date().toISOString(),
        reviewerId: profile?.uid,
        reviewerName: profile?.displayName,
        updatedBy: profile?.uid,
      });
      await logActivity({
        action: "Complete Test Review",
        entityType: "tests",
        entityId: resultOpen.id,
        entityLabel: resultOpen.testNumber,
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      toast.success("Review completed");
      setResultOpen(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    } finally {
      setSaving(false);
    }
  };

  const saveResults = async (nextStatus: LabTest["status"]) => {
    if (!resultOpen) return;

    if (nextStatus === "approved" && resultOpen.status !== "in_review") {
      toast.error("Test must be in review before approval");
      return;
    }
    if (nextStatus === "released" && resultOpen.status !== "approved") {
      toast.error("Test must be approved before release");
      return;
    }
    if (
      (nextStatus === "approved" || nextStatus === "released") &&
      !signatureReason.trim()
    ) {
      toast.error("Electronic signature reason is required");
      return;
    }

    setSaving(true);
    try {
      const evaluated = parameters.map(evaluateParameter);
      const hasFail = evaluated.some((param) => param.resultStatus === "fail");
      const payload: Record<string, unknown> = {
        parameters: evaluated,
        resultStatus: hasFail ? "fail" : "pass",
        status: nextStatus,
        updatedBy: profile?.uid,
      };
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

      const analystUid = resolveAnalystUid(resultOpen.analystId);
      if (analystUid && ["approved", "rejected", "released"].includes(nextStatus)) {
        await notifyTestDecision(analystUid, resultOpen.testNumber, nextStatus);
      }
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
    if (!hasPermission("recordResults") && !hasPermission("manageSamples")) {
      toast.error("You do not have permission to initiate a retest");
      return;
    }
    setSaving(true);
    try {
      await updateDocument(COLLECTIONS.tests, test.id, {
        status: "pending",
        resultStatus: "retest",
        retestCount: (test.retestCount || 0) + 1,
        parameters: (test.parameters || []).map((param) => ({
          ...param,
          observedValue: null,
          resultStatus: "pending",
        })),
        updatedBy: profile?.uid,
      });
      await logAudit({
        entityType: "tests",
        entityId: test.id,
        entityLabel: test.testNumber,
        field: "status",
        oldValue: test.status,
        newValue: "pending",
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        action: "update",
        reason: "Retest initiated",
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
      const analystUid = resolveAnalystUid(test.analystId);
      if (analystUid) {
        await notifyTestAssigned(analystUid, test.testNumber);
      }
      toast.success("Retest initiated");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retest failed");
    } finally {
      setSaving(false);
    }
  };

  const canRecordResults =
    !!resultOpen &&
    hasPermission("recordResults") &&
    resultOpen.status === "pending";

  const canSubmitForReview =
    !!resultOpen &&
    hasPermission("recordResults") &&
    resultOpen.status === "pending";

  const canCompleteReview =
    !!resultOpen && hasPermission("review") && resultOpen.status === "in_review";

  const canApprove =
    !!resultOpen && hasPermission("approve") && resultOpen.status === "in_review";

  const canRelease =
    !!resultOpen && hasPermission("release") && resultOpen.status === "approved";

  const canReject =
    !!resultOpen &&
    hasPermission("approve") &&
    ["pending", "in_review"].includes(resultOpen.status);

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

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test #, sample, analyst..."
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(
              [
                "pending",
                "in_review",
                "approved",
                "rejected",
                "released",
                "cancelled",
              ] as ApprovalStatus[]
            ).map((status) => (
              <SelectItem key={status} value={status}>
                {status.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeTests.length >= TEST_FETCH_LIMIT && (
        <p className="mb-4 text-sm text-muted-foreground">
          Showing the latest {TEST_FETCH_LIMIT.toLocaleString()} tests. Older records
          may not appear in this list.
        </p>
      )}

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
                          {(hasPermission("recordResults") ||
                            hasPermission("manageSamples")) &&
                            !["released", "cancelled"].includes(test.status) && (
                              <DropdownMenuItem onClick={() => retest(test)}>
                                <RotateCcw className="mr-2 size-4" />
                                Retest
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
          <div className="flex justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {total} tests · Page {page}/{totalPages}
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
                  {eligibleSamples.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No eligible samples
                    </SelectItem>
                  ) : (
                    eligibleSamples.map((sample) => (
                      <SelectItem key={sample.id} value={sample.id}>
                        {sample.sampleNumber}
                        {sample.productName ? ` · ${sample.productName}` : ""}
                      </SelectItem>
                    ))
                  )}
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
                  {activeTestMasters.map((master) => (
                    <SelectItem key={master.id} value={master.id}>
                      {master.name}
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
                  {analysts.map((analyst) => (
                    <SelectItem key={analyst.id} value={analyst.id}>
                      {analyst.displayName}
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
            <Button
              onClick={createTest}
              disabled={saving || !sampleId || !testMasterId || eligibleSamples.length === 0}
            >
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
          {resultOpen && (
            <div className="mb-2 flex flex-wrap gap-2 text-sm">
              <StatusBadge status={resultOpen.status} />
              <StatusBadge status={resultOpen.resultStatus} />
              {resultOpen.reviewerName && (
                <span className="text-muted-foreground">
                  Reviewer: {resultOpen.reviewerName}
                </span>
              )}
            </div>
          )}
          <div className="space-y-4">
            {parameters.map((param, index) => (
              <div key={param.parameterId || index} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium">{param.name}</p>
                  <StatusBadge status={evaluateParameter(param).resultStatus} />
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Limits: {param.lowerLimit ?? "—"} – {param.upperLimit ?? "—"}{" "}
                  {param.unit || ""}
                </p>
                <Input
                  className="rounded-xl"
                  value={param.observedValue?.toString() ?? ""}
                  disabled={!canRecordResults}
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
            {(canApprove || canRelease) && (
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
            {canRecordResults && (
              <Button variant="outline" disabled={saving} onClick={saveDraft}>
                Save Draft
              </Button>
            )}
            {canSubmitForReview && (
              <Button variant="outline" disabled={saving} onClick={submitForReview}>
                Submit for Review
              </Button>
            )}
            {canCompleteReview && (
              <Button variant="outline" disabled={saving} onClick={completeReview}>
                Complete Review
              </Button>
            )}
            {canApprove && (
              <Button disabled={saving} onClick={() => saveResults("approved")}>
                <Check className="mr-2 size-4" />
                Approve
              </Button>
            )}
            {canRelease && (
              <Button disabled={saving} onClick={() => saveResults("released")}>
                Release
              </Button>
            )}
            {canReject && (
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
