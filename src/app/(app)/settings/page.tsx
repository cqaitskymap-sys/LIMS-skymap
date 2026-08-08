"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Eye, EyeOff, Moon, Monitor, Sun } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { APP_NAME, COLLECTIONS, ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/constants";
import { logActivity, logAudit, updateDocument } from "@/lib/firebase/firestore";
import { formatDateTime, cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/states";
import { SectionCard } from "@/components/shared/file-upload";
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserRole } from "@/types";

const PERMISSION_LABELS: Record<
  keyof (typeof ROLE_PERMISSIONS)[UserRole],
  string
> = {
  manageUsers: "Manage users",
  manageMasters: "Manage masters",
  manageSamples: "Manage samples",
  recordResults: "Record test results",
  review: "Review tests",
  approve: "Approve results / reports",
  release: "Release tests / reports",
  viewReports: "View reports",
  export: "Export data",
};

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 2) return { label: "Weak", className: "text-rose-600" };
  if (score <= 3) return { label: "Fair", className: "text-amber-600" };
  return { label: "Strong", className: "text-emerald-600" };
}

export default function SettingsPage() {
  const { profile, changePassword, refreshProfile, isRole } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || "");
    setPhone(profile.phone || "");
  }, [profile]);

  const permissions = useMemo(() => {
    if (!profile) return [];
    return Object.entries(ROLE_PERMISSIONS[profile.role] || {}).map(
      ([key, enabled]) => ({
        key: key as keyof (typeof ROLE_PERMISSIONS)[UserRole],
        enabled: Boolean(enabled),
        label:
          PERMISSION_LABELS[key as keyof (typeof ROLE_PERMISSIONS)[UserRole]] ||
          key,
      })
    );
  }, [profile]);

  const profileDirty =
    displayName.trim() !== (profile?.displayName || "").trim() ||
    phone.trim() !== (profile?.phone || "").trim();

  const strength = password ? passwordStrength(password) : null;

  const saveProfile = async () => {
    if (!profile) return;
    const nextName = displayName.trim();
    const nextPhone = phone.trim();
    if (!nextName) {
      toast.error("Display name is required");
      return;
    }
    if (nextPhone && !isValidPhone(nextPhone)) {
      toast.error("Enter a valid phone number");
      return;
    }

    setSavingProfile(true);
    try {
      if (nextName !== (profile.displayName || "")) {
        await logAudit({
          entityType: "users",
          entityId: profile.id,
          entityLabel: nextName,
          field: "Display Name",
          oldValue: profile.displayName || "",
          newValue: nextName,
          userId: profile.uid,
          userName: profile.displayName || "User",
          action: "update",
          reason: "Profile update from Settings",
        });
      }
      if (nextPhone !== (profile.phone || "")) {
        await logAudit({
          entityType: "users",
          entityId: profile.id,
          entityLabel: nextName,
          field: "Phone",
          oldValue: profile.phone || "",
          newValue: nextPhone,
          userId: profile.uid,
          userName: profile.displayName || "User",
          action: "update",
          reason: "Profile update from Settings",
        });
      }

      await updateDocument(COLLECTIONS.users, profile.id, {
        displayName: nextName,
        phone: nextPhone || undefined,
        updatedBy: profile.uid,
      });
      await logActivity({
        action: "Update Profile",
        entityType: "users",
        entityId: profile.id,
        entityLabel: nextName,
        userId: profile.uid,
        userName: nextName,
        userEmail: profile.email,
        details: "Updated profile from Settings",
      });
      await refreshProfile();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profile update failed");
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(password);
      toast.success("Password updated");
      setPassword("");
      setConfirm("");
      setShowPassword(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (
        message.includes("requires-recent-login") ||
        message.toLowerCase().includes("recent")
      ) {
        toast.error(
          "For security, sign out and sign in again before changing your password."
        );
      } else {
        toast.error(message || "Password update failed");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Manage your profile, security, theme, and role access."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Profile"
          description="Update your display name and contact details."
          action={
            isRole("admin") ? (
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <Link href="/users">User Management</Link>
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                className="rounded-xl"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                className="rounded-xl"
                value={profile?.email || ""}
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Email is managed by an administrator and cannot be changed here.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                className="rounded-xl"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Role</p>
                <div className="mt-1">
                  {profile ? (
                    <StatusBadge
                      status={profile.role}
                      label={ROLE_LABELS[profile.role]}
                    />
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <div className="mt-1">
                  <ActiveBadge active={profile?.isActive !== false} />
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Department</p>
                <p className="mt-1 font-medium">
                  {profile?.departmentName || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Laboratory</p>
                <p className="mt-1 font-medium">
                  {profile?.laboratoryName || "—"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Last login</p>
                <p className="mt-1 font-medium">
                  {profile?.lastLoginAt
                    ? formatDateTime(profile.lastLoginAt)
                    : "—"}
                </p>
              </div>
            </div>
            <Button
              onClick={saveProfile}
              disabled={savingProfile || !profileDirty}
              className="rounded-xl"
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Appearance"
          description="Choose light, dark, or system theme."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ].map((option) => {
                const Icon = option.icon;
                const active = mounted && theme === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={active ? "default" : "outline"}
                    className={cn("h-auto flex-col gap-1 rounded-xl py-3")}
                    onClick={() => setTheme(option.value)}
                  >
                    <Icon className="size-4" />
                    <span className="text-xs">{option.label}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              Current appearance:{" "}
              <span className="font-medium text-foreground">
                {mounted
                  ? resolvedTheme === "dark"
                    ? "Dark"
                    : "Light"
                  : "—"}
              </span>
              {mounted && theme === "system" ? " (following system)" : ""}
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Change Password"
          description="Use a strong password you do not reuse elsewhere."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="rounded-xl pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
              {strength ? (
                <p className={cn("text-xs", strength.className)}>
                  Strength: {strength.label}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                className="rounded-xl"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>
            <Button
              onClick={onChangePassword}
              disabled={savingPassword || !password || !confirm}
              className="rounded-xl"
            >
              {savingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Role permissions"
          description={`Access granted to your ${
            profile ? ROLE_LABELS[profile.role] : "current"
          } role.`}
        >
          <ul className="space-y-2">
            {permissions.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
              >
                <span>{item.label}</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    item.enabled
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {item.enabled ? "Allowed" : "Restricted"}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="About"
          description="Application information for this environment."
        >
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Application:</span>{" "}
              <span className="font-medium">{APP_NAME}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Module:</span>{" "}
              Pharmaceutical LIMS
            </p>
            <p className="text-muted-foreground">
              For role or department changes, contact your system administrator.
            </p>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
