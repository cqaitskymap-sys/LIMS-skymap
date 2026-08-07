"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardPlus,
  FilePlus2,
  FlaskConical,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCollection } from "@/hooks/use-firestore";
import { COLLECTIONS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell, StatCardSkeleton } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityLog, AppUser, LabTest, Report, Sample } from "@/types";

const COLORS = ["#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#14b8a6"];

function StatCard({
  title,
  value,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "success" | "danger";
}) {
  const tones = {
    default: "bg-primary/10 text-primary",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  };
  return (
    <Card className="rounded-2xl border-border/70 soft-shadow">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${tones[tone]}`}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: samples, loading: loadingSamples } = useCollection<Sample>(
    COLLECTIONS.samples
  );
  const { data: tests, loading: loadingTests } = useCollection<LabTest>(
    COLLECTIONS.tests
  );
  const { data: reports, loading: loadingReports } = useCollection<Report>(
    COLLECTIONS.reports
  );
  const { data: users, loading: loadingUsers } = useCollection<AppUser>(
    COLLECTIONS.users
  );
  const { data: activities, loading: loadingActivities } =
    useCollection<ActivityLog>(COLLECTIONS.activities);

  const loading =
    loadingSamples ||
    loadingTests ||
    loadingReports ||
    loadingUsers ||
    loadingActivities;

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const pendingSamples = samples.filter((s) =>
      ["received", "pending", "in_testing"].includes(s.status)
    ).length;
    const completedTests = tests.filter((t) =>
      ["approved", "released"].includes(t.status)
    ).length;
    const approvedReports = reports.filter((r) => r.status === "approved").length;
    const rejectedReports = reports.filter((r) => r.status === "rejected").length;
    const todaysSamples = samples.filter((s) =>
      (s.receivedDate || "").startsWith(today)
    ).length;
    const pendingApproval = [
      ...tests.filter((t) => ["pending", "in_review"].includes(t.status)),
      ...reports.filter((r) => ["pending", "in_review"].includes(r.status)),
    ].length;
    return {
      totalSamples: samples.length,
      pendingSamples,
      completedTests,
      approvedReports,
      rejectedReports,
      todaysSamples,
      pendingApproval,
      laboratoryUsers: users.filter((u) => u.isActive !== false).length,
    };
  }, [samples, tests, reports, users, today]);

  const sampleStatusData = useMemo(() => {
    const map = new Map<string, number>();
    samples.forEach((s) => map.set(s.status, (map.get(s.status) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value,
    }));
  }, [samples]);

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleString("en", { month: "short" }),
        count: 0,
      };
    });
    samples.forEach((s) => {
      const key = (s.receivedDate || s.createdAt || "").slice(0, 7);
      const row = months.find((m) => m.key === key);
      if (row) row.count += 1;
    });
    return months;
  }, [samples]);

  const approvalData = useMemo(() => {
    const statuses = ["pending", "in_review", "approved", "rejected", "released"];
    return statuses.map((status) => ({
      name: status.replace(/_/g, " "),
      tests: tests.filter((t) => t.status === status).length,
      reports: reports.filter((r) => r.status === status).length,
    }));
  }, [tests, reports]);

  const recentActivities = activities.slice(0, 8);

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Real-time overview of laboratory operations and quality workflows."
        breadcrumbs={[{ label: "Dashboard" }]}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Samples" value={stats.totalSamples} icon={FlaskConical} />
            <StatCard
              title="Pending Samples"
              value={stats.pendingSamples}
              icon={ClipboardPlus}
              tone="warning"
            />
            <StatCard
              title="Completed Tests"
              value={stats.completedTests}
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard
              title="Approved Reports"
              value={stats.approvedReports}
              icon={FilePlus2}
              tone="success"
            />
            <StatCard
              title="Rejected Reports"
              value={stats.rejectedReports}
              icon={XCircle}
              tone="danger"
            />
            <StatCard title="Today's Samples" value={stats.todaysSamples} icon={FlaskConical} />
            <StatCard
              title="Pending Approval"
              value={stats.pendingApproval}
              icon={ClipboardPlus}
              tone="warning"
            />
            <StatCard title="Laboratory Users" value={stats.laboratoryUsers} icon={Users} />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <Card className="rounded-2xl soft-shadow xl:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Sample Status</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {sampleStatusData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sample data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sampleStatusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {sampleStatusData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl soft-shadow xl:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Monthly Samples</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl soft-shadow xl:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Approval Status</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={approvalData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} hide />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="tests" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="reports" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="rounded-2xl soft-shadow lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button asChild className="h-11 justify-start rounded-xl">
                  <Link href="/samples">
                    <FlaskConical className="mr-2 size-4" />
                    Add Sample
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-11 justify-start rounded-xl">
                  <Link href="/testing">
                    <ClipboardPlus className="mr-2 size-4" />
                    Create Test
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-11 justify-start rounded-xl">
                  <Link href="/reports">
                    <FilePlus2 className="mr-2 size-4" />
                    Generate Report
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-11 justify-start rounded-xl">
                  <Link href="/users">
                    <UserPlus className="mr-2 size-4" />
                    User Management
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl soft-shadow lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Recent Activities</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/activities">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                ) : (
                  recentActivities.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.action}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.userName}
                          {item.entityLabel ? ` · ${item.entityLabel}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusBadge status="pending" label={item.entityType} />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageShell>
  );
}
