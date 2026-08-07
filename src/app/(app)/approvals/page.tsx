"use client";

import Link from "next/link";
import { COLLECTIONS } from "@/lib/constants";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LabTest, Report } from "@/types";

export default function ApprovalsPage() {
  const { data: tests, loading: loadingTests, error: testsError } =
    useCollection<LabTest>(COLLECTIONS.tests);
  const { data: reports, loading: loadingReports, error: reportsError } =
    useCollection<Report>(COLLECTIONS.reports);

  const pendingTests = tests.filter((t) =>
    ["pending", "in_review"].includes(t.status)
  );
  const pendingReports = reports.filter((r) =>
    ["pending", "in_review"].includes(r.status)
  );

  const loading = loadingTests || loadingReports;
  const error = testsError || reportsError;

  return (
    <PageShell>
      <PageHeader
        title="Approvals"
        description="Analyst → Reviewer → QA → Approved → Released workflow queue."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Approvals" },
        ]}
      />

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState description={error} />
      ) : pendingTests.length + pendingReports.length === 0 ? (
        <EmptyState title="No pending approvals" />
      ) : (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border bg-card soft-shadow">
            <div className="border-b px-4 py-3 font-medium">Pending Tests</div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test #</TableHead>
                    <TableHead>Sample</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTests.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell>{test.testNumber}</TableCell>
                      <TableCell>{test.sampleNumber}</TableCell>
                      <TableCell>
                        <StatusBadge status={test.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href="/testing">Review</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border bg-card soft-shadow">
            <div className="border-b px-4 py-3 font-medium">Pending Reports</div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>{report.reportNumber}</TableCell>
                      <TableCell>{report.title}</TableCell>
                      <TableCell>
                        <StatusBadge status={report.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href="/reports">Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}
