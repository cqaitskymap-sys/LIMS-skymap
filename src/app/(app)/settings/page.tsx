"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { ROLE_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/states";
import { SectionCard } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/layout/brand";

export default function SettingsPage() {
  const { profile, changePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const onChangePassword = async () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await changePassword(password);
      toast.success("Password updated");
      setPassword("");
      setConfirm("");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Re-authenticate and try again"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Profile, security, and appearance preferences."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Profile">
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium">{profile?.displayName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{profile?.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Role</p>
              <p className="font-medium">
                {profile ? ROLE_LABELS[profile.role] : "—"}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Appearance" description="Toggle light and dark mode.">
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">
              Theme follows system by default
            </span>
          </div>
        </SectionCard>

        <SectionCard
          title="Change Password"
          description="Update your account password securely."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                className="rounded-xl"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                className="rounded-xl"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button onClick={onChangePassword} disabled={saving} className="rounded-xl">
              {saving ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
