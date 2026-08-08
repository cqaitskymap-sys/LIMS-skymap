"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { doc, setDoc } from "firebase/firestore";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { createAuthUser } from "@/lib/firebase/admin-auth";
import { COLLECTIONS, PAGE_SIZE, ROLE_LABELS } from "@/lib/constants";
import {
  listDocumentsSafe,
  logActivity,
  logAudit,
  nowIso,
  updateDocument,
} from "@/lib/firebase/firestore";
import {
  useCollection,
  useDebouncedValue,
  usePagination,
} from "@/hooks/use-firestore";
import { useSearchQueryParam } from "@/hooks/use-search-query";
import { formatDateTime } from "@/lib/utils";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PageHeader } from "@/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  PageShell,
  TableSkeleton,
} from "@/components/shared/states";
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import type { AppUser, Department, Laboratory, UserRole } from "@/types";

const USER_FETCH_LIMIT = 5000;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

const emptyForm = () => ({
  email: "",
  password: "",
  displayName: "",
  role: "analyst" as UserRole,
  phone: "",
  departmentId: "",
  laboratoryId: "",
});

function UsersContent() {
  const { profile } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useCollection<AppUser>(
    COLLECTIONS.users,
    refreshKey,
    USER_FETCH_LIMIT
  );
  const [search, setSearch] = useState("");
  useSearchQueryParam(setSearch);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "active"
  );
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const debounced = useDebouncedValue(search);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<AppUser | null>(null);
  const [toggling, setToggling] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      listDocumentsSafe<Department>(COLLECTIONS.departments, [], USER_FETCH_LIMIT),
      listDocumentsSafe<Laboratory>(COLLECTIONS.laboratories, [], USER_FETCH_LIMIT),
    ])
      .then(([deps, labs]) => {
        if (!active) return;
        setDepartments(deps.filter((item) => item.isActive !== false));
        setLaboratories(labs.filter((item) => item.isActive !== false));
      })
      .catch(() => {
        if (!active) return;
        setDepartments([]);
        setLaboratories([]);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return data.filter((user) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? user.isActive !== false
          : user.isActive === false);
      if (!matchesStatus) return false;
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (user.displayName || "").toLowerCase().includes(q) ||
        (user.email || "").toLowerCase().includes(q) ||
        (user.role || "").toLowerCase().includes(q) ||
        (ROLE_LABELS[user.role] || "").toLowerCase().includes(q) ||
        (user.phone || "").toLowerCase().includes(q) ||
        (user.departmentName || "").toLowerCase().includes(q) ||
        (user.laboratoryName || "").toLowerCase().includes(q)
      );
    });
  }, [data, debounced, statusFilter, roleFilter]);

  const { page, setPage, totalPages, pageItems, total } = usePagination(
    filtered,
    PAGE_SIZE
  );

  const activeLabsForDepartment = useMemo(() => {
    if (!form.departmentId) return laboratories;
    return laboratories.filter(
      (lab) => !lab.departmentId || lab.departmentId === form.departmentId
    );
  }, [laboratories, form.departmentId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (user: AppUser) => {
    setEditing(user);
    setForm({
      email: user.email,
      password: "",
      displayName: user.displayName,
      role: user.role,
      phone: user.phone || "",
      departmentId: user.departmentId || "",
      laboratoryId: user.laboratoryId || "",
    });
    setOpen(true);
  };

  const save = async () => {
    const displayName = form.displayName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();

    if (!displayName || !email) {
      toast.error("Name and email are required");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (phone && !isValidPhone(phone)) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (!editing && form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (
      editing &&
      editing.uid === profile?.uid &&
      form.role !== editing.role
    ) {
      toast.error("You cannot change your own role");
      return;
    }

    const duplicateEmail = data.find(
      (row) =>
        row.id !== editing?.id &&
        (row.email || "").trim().toLowerCase() === email
    );
    if (duplicateEmail) {
      toast.error("A user with this email already exists");
      return;
    }

    const department = departments.find((item) => item.id === form.departmentId);
    const laboratory = laboratories.find((item) => item.id === form.laboratoryId);

    setSaving(true);
    try {
      if (editing) {
        const payload = {
          displayName,
          role: form.role,
          phone: phone || undefined,
          departmentId: form.departmentId || undefined,
          departmentName: department?.name,
          laboratoryId: form.laboratoryId || undefined,
          laboratoryName: laboratory?.name,
          updatedBy: profile?.uid,
        };

        if (editing.role !== form.role) {
          await logAudit({
            entityType: "users",
            entityId: editing.id,
            entityLabel: displayName,
            field: "Role",
            oldValue: ROLE_LABELS[editing.role],
            newValue: ROLE_LABELS[form.role],
            userId: profile?.uid || "",
            userName: profile?.displayName || "User",
            action: "update",
            reason: "User role change",
          });
        }

        await updateDocument(COLLECTIONS.users, editing.id, payload);
        await logActivity({
          action: "Edit User",
          entityType: "users",
          entityId: editing.id,
          entityLabel: displayName,
          userId: profile?.uid || "",
          userName: profile?.displayName || "User",
          userEmail: profile?.email,
        });
        toast.success("User updated");
      } else {
        const uid = await createAuthUser(email, form.password);
        const userDoc: AppUser = {
          id: uid,
          uid,
          email,
          displayName,
          role: form.role,
          phone: phone || undefined,
          departmentId: form.departmentId || undefined,
          departmentName: department?.name,
          laboratoryId: form.laboratoryId || undefined,
          laboratoryName: laboratory?.name,
          isActive: true,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          createdBy: profile?.uid,
        };
        await setDoc(doc(db, COLLECTIONS.users, uid), userDoc);
        await logAudit({
          entityType: "users",
          entityId: uid,
          entityLabel: displayName,
          field: "record",
          oldValue: "",
          newValue: "created",
          userId: profile?.uid || "",
          userName: profile?.displayName || "User",
          action: "create",
        });
        await logActivity({
          action: "Create User",
          entityType: "users",
          entityId: uid,
          entityLabel: displayName,
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

  const confirmToggle = async () => {
    if (!toggleTarget) return;
    if (toggleTarget.uid === profile?.uid) {
      toast.error("You cannot deactivate your own account");
      setToggleTarget(null);
      return;
    }

    const activating = toggleTarget.isActive === false;
    setToggling(true);
    try {
      await updateDocument(COLLECTIONS.users, toggleTarget.id, {
        isActive: activating,
        updatedBy: profile?.uid,
      });
      await logAudit({
        entityType: "users",
        entityId: toggleTarget.id,
        entityLabel: toggleTarget.displayName,
        field: "Status",
        oldValue: activating ? "Inactive" : "Active",
        newValue: activating ? "Active" : "Inactive",
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        action: activating ? "update" : "delete",
        reason: activating ? "User activated" : "User deactivated",
      });
      await logActivity({
        action: activating ? "Activate User" : "Deactivate User",
        entityType: "users",
        entityId: toggleTarget.id,
        entityLabel: toggleTarget.displayName,
        userId: profile?.uid || "",
        userName: profile?.displayName || "User",
        userEmail: profile?.email,
      });
      toast.success(activating ? "User activated" : "User deactivated");
      setToggleTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setToggling(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="User Management"
        description="Create users, assign roles, and manage laboratory access."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Users" },
        ]}
        actions={
          <Button className="h-10 rounded-xl" onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            Add User
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl pl-9"
            placeholder="Search by name, email, role, phone..."
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as "all" | "active" | "inactive")
          }
        >
          <SelectTrigger className="h-10 w-full rounded-xl sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={roleFilter}
          onValueChange={(value) =>
            setRoleFilter(value as "all" | UserRole)
          }
        >
          <SelectTrigger className="h-10 w-full rounded-xl sm:w-44">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.length >= USER_FETCH_LIMIT && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
          Showing the latest {USER_FETCH_LIMIT.toLocaleString()} users. Older
          entries may not appear.
        </p>
      )}

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState description={error} onRetry={() => setRefreshKey((k) => k + 1)} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No users found"
          action={
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Add User
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card soft-shadow">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Laboratory</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.displayName}
                      {user.uid === profile?.uid ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (you)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={user.role}
                        label={ROLE_LABELS[user.role]}
                      />
                    </TableCell>
                    <TableCell>{user.departmentName || "—"}</TableCell>
                    <TableCell>{user.laboratoryName || "—"}</TableCell>
                    <TableCell>{user.phone || "—"}</TableCell>
                    <TableCell>
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={user.isActive !== false} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="Actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className={
                              user.isActive !== false ? "text-destructive" : undefined
                            }
                            disabled={user.uid === profile?.uid}
                            onClick={() => setToggleTarget(user)}
                          >
                            {user.isActive === false ? "Activate" : "Deactivate"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {total} users · Page {page}/{totalPages}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Create User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name *</Label>
              <Input
                className="rounded-xl"
                placeholder="Full name"
                value={form.displayName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                className="rounded-xl"
                type="email"
                placeholder="user@company.com"
                disabled={!!editing}
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Temporary Password *</Label>
                <Input
                  className="rounded-xl"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={form.password}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select
                value={form.role}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, role: value as UserRole }))
                }
                disabled={editing?.uid === profile?.uid}
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
              {editing?.uid === profile?.uid ? (
                <p className="text-xs text-muted-foreground">
                  You cannot change your own role.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={form.departmentId || "__none__"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    departmentId: value === "__none__" ? "" : value,
                    laboratoryId:
                      value === "__none__" ||
                      !laboratories.find(
                        (lab) =>
                          lab.id === prev.laboratoryId &&
                          (!lab.departmentId || lab.departmentId === value)
                      )
                        ? ""
                        : prev.laboratoryId,
                  }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {departments.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Laboratory</Label>
              <Select
                value={form.laboratoryId || "__none__"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    laboratoryId: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select laboratory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {activeLabsForDepartment.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                className="rounded-xl"
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
            {editing?.lastLoginAt ? (
              <p className="text-xs text-muted-foreground">
                Last login {formatDateTime(editing.lastLoginAt)}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="rounded-xl">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(value) => !value && setToggleTarget(null)}
        title={
          toggleTarget?.isActive === false
            ? "Activate user?"
            : "Deactivate user?"
        }
        description={
          toggleTarget?.isActive === false
            ? `${toggleTarget.displayName} will be able to sign in again.`
            : `${toggleTarget?.displayName || "This user"} will not be able to sign in until reactivated.`
        }
        confirmLabel={
          toggleTarget?.isActive === false ? "Activate" : "Deactivate"
        }
        destructive={toggleTarget?.isActive !== false}
        loading={toggling}
        onConfirm={confirmToggle}
      />
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
