"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ExternalLink,
  Info,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  markAllNotificationsRead,
  markNotificationRead,
  useUserNotifications,
} from "@/hooks/use-notifications";
import { NOTIFICATION_TYPE_STYLES } from "@/lib/notifications";
import { PageHeader } from "@/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  PageShell,
  TableSkeleton,
} from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AppNotification } from "@/types";

const TYPE_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: AlertCircle,
} as const;

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [marking, setMarking] = useState(false);
  const { data, loading, error, unreadCount } = useUserNotifications(
    profile?.uid,
    refreshKey
  );

  const visible = useMemo(() => {
    if (filter === "unread") return data.filter((item) => !item.isRead);
    return data;
  }, [data, filter]);

  const markRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark as read");
    }
  };

  const markAll = async () => {
    const unreadIds = data.filter((item) => !item.isRead).map((item) => item.id);
    if (!unreadIds.length) return;
    setMarking(true);
    try {
      await markAllNotificationsRead(unreadIds);
      toast.success("All notifications marked as read");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark all as read");
    } finally {
      setMarking(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        description="Approvals, assignments, and system alerts for your account."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Notifications" },
        ]}
        actions={
          <Button
            variant="outline"
            onClick={markAll}
            disabled={marking || unreadCount === 0}
          >
            Mark all read
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          All ({data.length})
        </Button>
        <Button
          size="sm"
          variant={filter === "unread" ? "default" : "outline"}
          onClick={() => setFilter("unread")}
        >
          Unread ({unreadCount})
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : error ? (
        <ErrorState
          title="Failed to load notifications"
          description={error}
          onRetry={() => setRefreshKey((k) => k + 1)}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === "unread" ? "No unread notifications" : "You're all caught up"}
          description={
            filter === "unread"
              ? "Switch to All to see previously read alerts."
              : "New assignments and approval requests will appear here."
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={markRead}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
}) {
  const Icon = TYPE_ICONS[notification.type] || Info;

  return (
    <Card
      className={`rounded-2xl border soft-shadow ${NOTIFICATION_TYPE_STYLES[notification.type]} ${
        notification.isRead ? "opacity-75" : ""
      }`}
    >
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-xl bg-background/80 p-2">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{notification.title}</p>
              <Badge variant="secondary" className="rounded-full capitalize">
                {notification.type}
              </Badge>
              {!notification.isRead && (
                <Badge className="rounded-full">New</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {notification.message}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatDateTime(notification.createdAt)}
            </p>
            {notification.link && (
              <Button asChild size="sm" variant="link" className="mt-1 h-auto px-0">
                <Link href={notification.link}>
                  Open related page
                  <ExternalLink className="ml-1 size-3" />
                </Link>
              </Button>
            )}
          </div>
        </div>
        {!notification.isRead && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMarkRead(notification.id)}
          >
            Mark read
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
