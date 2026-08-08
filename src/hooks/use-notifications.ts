"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listDocumentsSafe,
  updateDocument,
  where,
} from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/constants";
import {
  dispatchNotificationsUpdated,
  NOTIFICATIONS_UPDATED_EVENT,
} from "@/lib/notifications";
import type { AppNotification } from "@/types";

function sortNotifications(items: AppNotification[]) {
  return [...items].sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );
}

export function useUserNotifications(userId: string | undefined, refreshKey = 0) {
  const [data, setData] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    listDocumentsSafe<AppNotification>(COLLECTIONS.notifications, [
      where("userId", "==", userId),
    ])
      .then((rows) => {
        if (active) setData(sortNotifications(rows));
      })
      .catch((err: Error) => {
        if (active) setError(err.message || "Failed to load notifications");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, refreshKey]);

  const unreadCount = useMemo(
    () => data.filter((item) => !item.isRead).length,
    [data]
  );

  return { data, loading, error, unreadCount };
}

export function useUnreadNotificationCount(userId: string | undefined) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    try {
      const rows = await listDocumentsSafe<AppNotification>(
        COLLECTIONS.notifications,
        [where("userId", "==", userId)]
      );
      setCount(rows.filter((item) => !item.isRead).length);
    } catch {
      setCount(0);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return count;
}

export async function markNotificationRead(id: string) {
  await updateDocument(COLLECTIONS.notifications, id, { isRead: true });
  dispatchNotificationsUpdated();
}

export async function markAllNotificationsRead(ids: string[]) {
  await Promise.all(
    ids.map((id) => updateDocument(COLLECTIONS.notifications, id, { isRead: true }))
  );
  dispatchNotificationsUpdated();
}
