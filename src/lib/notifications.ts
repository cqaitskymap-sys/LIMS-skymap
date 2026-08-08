import { COLLECTIONS, ROLE_PERMISSIONS } from "@/lib/constants";
import { createNotification, listDocumentsSafe } from "@/lib/firebase/firestore";
import type { AppNotification, AppUser, UserRole } from "@/types";

export const NOTIFICATIONS_UPDATED_EVENT = "lims-notifications-updated";

type NotificationPayload = Omit<
  AppNotification,
  "id" | "createdAt" | "updatedAt" | "isRead"
>;

export function dispatchNotificationsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
  }
}

export async function notifyUser(payload: NotificationPayload) {
  if (!payload.userId) return;
  try {
    await createNotification(payload);
    dispatchNotificationsUpdated();
  } catch {
    // Notifications should not block primary workflows.
  }
}

export async function notifyUsers(
  userIds: string[],
  payload: Omit<NotificationPayload, "userId">
) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  await Promise.all(uniqueIds.map((userId) => notifyUser({ ...payload, userId })));
}

export async function notifyUsersByRoles(
  roles: UserRole[],
  payload: Omit<NotificationPayload, "userId">
) {
  const users = await listDocumentsSafe<AppUser>(COLLECTIONS.users);
  const userIds = users
    .filter((user) => user.isActive !== false && roles.includes(user.role))
    .map((user) => user.uid);
  await notifyUsers(userIds, payload);
}

export async function notifyUsersWithPermission(
  permission: keyof (typeof ROLE_PERMISSIONS)[UserRole],
  payload: Omit<NotificationPayload, "userId">
) {
  const users = await listDocumentsSafe<AppUser>(COLLECTIONS.users);
  const userIds = users
    .filter(
      (user) =>
        user.isActive !== false && ROLE_PERMISSIONS[user.role]?.[permission]
    )
    .map((user) => user.uid);
  await notifyUsers(userIds, payload);
}

export async function notifySampleAssigned(analystId: string, sampleNumber: string) {
  await notifyUser({
    userId: analystId,
    title: "Sample assigned",
    message: `Sample ${sampleNumber} has been assigned to you.`,
    type: "info",
    link: "/samples",
  });
}

export async function notifyTestAssigned(analystId: string, testNumber: string) {
  await notifyUser({
    userId: analystId,
    title: "Test assigned",
    message: `Test ${testNumber} is ready for execution.`,
    type: "info",
    link: "/testing",
  });
}

export async function notifyTestReviewRequired(testNumber: string) {
  await notifyUsersWithPermission("review", {
    title: "Test review required",
    message: `Test ${testNumber} is waiting for review.`,
    type: "warning",
    link: "/approvals",
  });
}

export async function notifyTestDecision(
  analystId: string,
  testNumber: string,
  status: string
) {
  const approved = ["approved", "released"].includes(status);
  await notifyUser({
    userId: analystId,
    title: approved ? "Test approved" : "Test updated",
    message: `Test ${testNumber} status changed to ${status.replace(/_/g, " ")}.`,
    type: approved ? "success" : "info",
    link: "/testing",
  });
}

export async function notifyReportApprovalRequired(reportNumber: string) {
  await notifyUsersWithPermission("approve", {
    title: "Report approval required",
    message: `Report ${reportNumber} is pending approval.`,
    type: "warning",
    link: "/approvals",
  });
}

export async function notifyReportApproved(userId: string, reportNumber: string) {
  await notifyUser({
    userId,
    title: "Report approved",
    message: `Report ${reportNumber} has been approved.`,
    type: "success",
    link: "/reports",
  });
}

export const NOTIFICATION_TYPE_STYLES: Record<
  AppNotification["type"],
  string
> = {
  info: "border-sky-500/30 bg-sky-50/50 dark:bg-sky-950/20",
  success: "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20",
  warning: "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20",
  error: "border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20",
};
