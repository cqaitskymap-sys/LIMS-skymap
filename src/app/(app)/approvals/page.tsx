"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, ExternalLink, FileText } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { COLLECTIONS } from "@/lib/constants";
import {
  logActivity,
  logAudit,
  updateDocument,
} from "@/lib/firebase/firestore";
import { notifyReportApproved } from "@/lib/notifications";
import { formatDateTime } from "@/lib/utils";
import { useCollection } from "@/hooks/use-firestore";
import { PageHeader } from "@/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  PageShell,
  TableSkeleton,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApprovalStatus, LabTest, Report } from "@/types";

const APPROVAL_FETCH_LIMIT = 5000;
const REPORT_QUEUE_STATUSES: ApprovalStatus[] = ["pending", "in_review"];

function sortByUpdatedAt<T extends { updatedAt?: string; createdAt?: string }>(
  items: T[]
) {
  return [...items].sort((a, b) =>
    (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "")
  );
}

export default function ApprovalsPage() {
  const { profile, hasPermission } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  const {
    data: tests,
    loading: loadingTests,
    error: testsError,
  } = useCollection<LabTest>(COLLECTIONS.tests, refreshKey, APPROVAL_FETCH_LIMIT);
  const {
    data: reports,
    loading: loadingReports,
    error: reportsError,
  } = useCollection<Report>(COLLECTIONS.reports, refreshKey, APPROVAL_FETCH_LIMIT);

  const canReview = hasPermission("review") || hasPermission("approve");
  const canApproveReports = hasPermission("approve");

  const reviewTests = useMemo(
    () =>
      sortByUpdatedAt(
        tests.filter(
          (test) =>
            test.isActive !== false &&
            test.status === "in_review"
        )
      ),
    [tests]
  );

  const pendingReports = useMemo(
    () =>
      sortByUpdatedAt(
        reports.filter(
          (report) =>
            report.isActive !== false &&
            REPORT_QUEUE_STATUSES.includes(report.status)
        )
      ),
    [reports]
  );

  const visibleTests = canReview ? reviewTests : [];
  const visibleReports = canApproveReports ? pendingReports : [];
  const totalPending = visibleTests.length + visibleReports.length;

  const loading = loadingTests || loadingReports;
  const error = testsError || reportsError;

  const approveReport = async (report: Report) => {
    setSavingId(report.id);
    try {
      await updateDocument(COLLECTIONS.reports, report.id, {
        status: "approved",
        approvedBy: profile?.uid,
        approvedByName: profile?.displayName,
        version: (report.version || 1) + 1,
        updatedBy: profile?.uid,
      });
      await logActivity({
        action: "Approve Report",
        entityType: "reports",
        entityId: report.id,
        entityLabel: report.reportNumber,
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      await logAudit({
        entityType: "reports",
        entityId: report.id,
        entityLabel: report.reportNumber,
        field: "status",
        oldValue: report.status,
        newValue: "approved",
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        action: "approve",
      });
      if (report.generatedBy) {
        await notifyReportApproved(report.generatedBy, report.reportNumber);
      }
      toast.success(`${report.reportNumber} approved`);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setSavingId(null);
    }
  };

  const rejectReport = async (report: Report) => {
    setSavingId(report.id);
    try {
      await updateDocument(COLLECTIONS.reports, report.id, {
        status: "rejected",
        updatedBy: profile?.uid,
      });
      await logActivity({
        action: "Reject Report",
        entityType: "reports",
        entityId: report.id,
        entityLabel: report.reportNumber,
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      await logAudit({
        entityType: "reports",
        entityId: report.id,
        entityLabel: report.reportNumber,
        field: "status",
        oldValue: report.status,
        newValue: "rejected",
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        action: "reject",
      });
      toast.success(`${report.reportNumber} rejected`);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Approvals"
        description="Review submitted tests and approve generated reports."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Approvals" },
        ]}
      />

      {!loading && !error && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="rounded-2xl soft-shadow">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">Tests in Review</p>
                <p className="mt-1 text-3xl font-semibold">{visibleTests.length}</p>
              </div>
              <ClipboardList className="size-8 text-primary/70" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl soft-shadow">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">Reports Pending</p>
                <p className="mt-1 text-3xl font-semibold">{visibleReports.length}</p>
              </div>
              <FileText className="size-8 text-primary/70" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl soft-shadow">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">Total Queue</p>
                <p className="mt-1 text-3xl font-semibold">{totalPending}</p>
              </div>
              <CheckCircle2 className="size-8 text-primary/70" />
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <ErrorState
          title="Failed to load approval queue"
          description={error}
          onRetry={() => setRefreshKey((key) => key + 1)}
        />
      ) : !canReview && !canApproveReports ? (
        <EmptyState
          title="No approval access"
          description="Your role does not include review or approve permissions."
        />
      ) : totalPending === 0 ? (
        <EmptyState
          title="No pending approvals"
          description="Submitted tests and generated reports awaiting action will appear here."
        />
      ) : (
        <div className="space-y-6">
          {canReview && (
            <section className="overflow-hidden rounded-2xl border bg-card soft-shadow">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="font-medium">Tests Awaiting Review</p>
                <span className="text-sm text-muted-foreground">
                  {visibleTests.length} item(s)
                </span>
              </div>
              {visibleTests.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  No tests are currently in review.
                </p>
              ) : (
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
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleTests.map((test) => (
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
                          <TableCell>
                            {formatDateTime(test.completedAt || test.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/testing?q=${encodeURIComponent(test.testNumber)}`}>
                                Review
                                <ExternalLink className="ml-1 size-3.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          )}

          {canApproveReports && (
            <section className="overflow-hidden rounded-2xl border bg-card soft-shadow">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="font-medium">Reports Awaiting Approval</p>
                <span className="text-sm text-muted-foreground">
                  {visibleReports.length} item(s)
                </span>
              </div>
              {visibleReports.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  No reports are currently pending approval.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report #</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Sample</TableHead>
                        <TableHead>Generated By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">
                            {report.reportNumber}
                          </TableCell>
                          <TableCell>{report.title}</TableCell>
                          <TableCell>{report.sampleNumber || "—"}</TableCell>
                          <TableCell>{report.generatedByName || "—"}</TableCell>
                          <TableCell>
                            <StatusBadge status={report.status} />
                          </TableCell>
                          <TableCell>{formatDateTime(report.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  href={`/reports?q=${encodeURIComponent(report.reportNumber)}`}
                                >
                                  Open
                                </Link>
                              </Button>
                              <Button
                                size="sm"
                                disabled={savingId === report.id}
                                onClick={() => approveReport(report)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={savingId === report.id}
                                onClick={() => rejectReport(report)}
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
