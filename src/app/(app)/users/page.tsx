"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { doc, setDoc } from "firebase/firestore";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { createAuthUser } from "@/lib/firebase/admin-auth";
import { COLLECTIONS, PAGE_SIZE, ROLE_LABELS } from "@/lib/constants";
import { logActivity, nowIso, updateDocument } from "@/lib/firebase/firestore";
import {
  useCollection,
  useDebouncedValue,
  usePagination,
} from "@/hooks/use-firestore";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PageHeader } from "@/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  PageShell,
  TableSkeleton,
} from "@/components/shared/states";
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { AppUser, UserRole } from "@/types";

function UsersContent() {
  const { profile } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useCollection<AppUser>(
    COLLECTIONS.users,
    refreshKey
  );
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "analyst" as UserRole,
    phone: "",
  });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return data.filter(
      (u) =>
        !q ||
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [data, debounced]);

  const { page, setPage, totalPages, pageItems } = usePagination(
    filtered,
    PAGE_SIZE
  );

  const save = async () => {
    if (!form.displayName.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateDocument(COLLECTIONS.users, editing.id, {
          displayName: form.displayName,
          role: form.role,
          phone: form.phone,
          updatedBy: profile?.uid,
        });
        await logActivity({
          action: "Edit User",
          entityType: "users",
          entityId: editing.id,
          entityLabel: form.displayName,
          userId: profile?.uid || "",
          userName: profile?.displayName || "User",
          userEmail: profile?.email,
        });
        toast.success("User updated");
      } else {
        if (form.password.length < 6) {
          toast.error("Password must be at least 6 characters");
          setSaving(false);
          return;
        }
        const uid = await createAuthUser(form.email, form.password);
        const userDoc: AppUser = {
          id: uid,
          uid,
          email: form.email,
          displayName: form.displayName,
          role: form.role,
          phone: form.phone,
          isActive: true,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          createdBy: profile?.uid,
        };
        await setDoc(doc(db, COLLECTIONS.users, uid), userDoc);
        await logActivity({
          action: "Create User",
          entityType: "users",
          entityId: uid,
          entityLabel: form.displayName,
          userId: profile?.uid || "",
          userName: profile?.displayName || "User",
          userEmail: profile?.email,
        });
        toast.success("User created");
      }
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: AppUser) => {
    await updateDocument(COLLECTIONS.users, user.id, {
      isActive: user.isActive === false,
    });
    await logActivity({
      action: user.isActive === false ? "Activate User" : "Deactivate User",
      entityType: "users",
      entityId: user.id,
      entityLabel: user.displayName,
      userId: profile?.uid || "",
      userName: profile?.displayName || "User",
      userEmail: profile?.email,
    });
    toast.success(
      user.isActive === false ? "User activated" : "User deactivated"
    );
    setRefreshKey((k) => k + 1);
  };

  return (
    <PageShell>
      <PageHeader
        title="User Management"
        description="Create users, assign roles, and manage access."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Users" },
        ]}
        actions={
          <Button
            className="h-10 rounded-xl"
            onClick={() => {
              setEditing(null);
              setForm({
                email: "",
                password: "",
                displayName: "",
                role: "analyst",
                phone: "",
              });
              setOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add User
          </Button>
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 rounded-xl pl-9"
          placeholder="Search users..."
        />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState description={error} onRetry={() => setRefreshKey((k) => k + 1)} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card soft-shadow">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.displayName}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={user.role}
                        label={ROLE_LABELS[user.role]}
                      />
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={user.isActive !== false} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(user);
                              setForm({
                                email: user.email,
                                password: "",
                                displayName: user.displayName,
                                role: user.role,
                                phone: user.phone || "",
                              });
                              setOpen(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive(user)}>
                            {user.isActive === false
                              ? "Activate"
                              : "Deactivate"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between border-t px-4 py-3 text-sm">
            <span>
              Page {page}/{totalPages}
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
            <DialogTitle>{editing ? "Edit User" : "Create User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                className="rounded-xl"
                value={form.displayName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, displayName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                className="rounded-xl"
                type="email"
                disabled={!!editing}
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
              />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Temporary Password</Label>
                <Input
                  className="rounded-xl"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, password: e.target.value }))
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, role: v as UserRole }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                className="rounded-xl"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

export default function UsersPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <UsersContent />
    </AuthGuard>
  );
}
