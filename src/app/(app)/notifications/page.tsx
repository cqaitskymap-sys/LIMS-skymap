"use client";

import { useState } from "react";
import { toast } from "sonner";
import { COLLECTIONS } from "@/lib/constants";
import { updateDocument } from "@/lib/firebase/firestore";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useCollection } from "@/hooks/use-firestore";
import { PageHeader } from "@/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  PageShell,
  TableSkeleton,
} from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AppNotification } from "@/types";

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useCollection<AppNotification>(
    COLLECTIONS.notifications,
    refreshKey
  );

  const mine = data.filter((n) => n.userId === profile?.uid);

  const markRead = async (id: string) => {
    await updateDocument(COLLECTIONS.notifications, id, { isRead: true });
    setRefreshKey((k) => k + 1);
  };

  const markAll = async () => {
    await Promise.all(
      mine.filter((n) => !n.isRead).map((n) => markRead(n.id))
    );
    toast.success("All notifications marked as read");
  };

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        description="Approvals, assignments, and system alerts."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Notifications" },
        ]}
        actions={
          <Button variant="outline" onClick={markAll}>
            Mark all read
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={4} />
      ) : error ? (
        <ErrorState description={error} />
      ) : mine.length === 0 ? (
        <EmptyState title="You're all caught up" />
      ) : (
        <div className="space-y-3">
          {mine.map((n) => (
            <Card
              key={n.id}
              className={`rounded-2xl soft-shadow ${n.isRead ? "opacity-70" : ""}`}
            >
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDateTime(n.createdAt)}
                  </p>
                </div>
                {!n.isRead && (
                  <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
