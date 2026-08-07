"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { COLLECTIONS, ROLE_PERMISSIONS } from "@/lib/constants";
import { logActivity, nowIso } from "@/lib/firebase/firestore";
import type { AppUser, UserRole } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (
    permission: keyof (typeof ROLE_PERMISSIONS)[UserRole]
  ) => boolean;
  isRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.users, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AppUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setProfile(null);
      return;
    }
    const data = await fetchProfile(auth.currentUser.uid);
    setProfile(data);
  }, []);

  const ensureUserProfile = useCallback(async (firebaseUser: User) => {
    let data = await fetchProfile(firebaseUser.uid);
    if (!data) {
      const bootstrap: AppUser = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        displayName:
          firebaseUser.displayName ||
          firebaseUser.email?.split("@")[0] ||
          "User",
        role: "admin",
        isActive: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await setDoc(doc(db, COLLECTIONS.users, firebaseUser.uid), bootstrap);
      data = bootstrap;
    }
    return data;
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const data = await ensureUserProfile(firebaseUser);
          setProfile(data);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [ensureUserProfile]);

  const login = useCallback(
    async (email: string, password: string, remember = true) => {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );
      if (typeof window !== "undefined") {
        localStorage.setItem("lims_remember", remember ? "1" : "0");
      }
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const data = await ensureUserProfile(cred.user);
      if (data.isActive === false) {
        await signOut(auth);
        throw new Error("Your account is inactive. Contact the administrator.");
      }
      setProfile(data);
      try {
        await setDoc(
          doc(db, COLLECTIONS.users, cred.user.uid),
          { lastLoginAt: nowIso(), updatedAt: nowIso() },
          { merge: true }
        );
      } catch {
        // Login should still succeed if profile timestamp update fails.
      }
      try {
        await logActivity({
          action: "Login",
          entityType: "user",
          entityId: cred.user.uid,
          entityLabel: data.displayName || email,
          userId: cred.user.uid,
          userName: data.displayName || email,
          userEmail: email,
          details: "User signed in",
        });
      } catch {
        // Activity logging must not block authentication.
      }
    },
    [ensureUserProfile]
  );

  const logout = useCallback(async () => {
    const current = auth.currentUser;
    const currentProfile = profile;
    if (current) {
      await logActivity({
        action: "Logout",
        entityType: "user",
        entityId: current.uid,
        entityLabel: currentProfile?.displayName || current.email || "",
        userId: current.uid,
        userName: currentProfile?.displayName || current.email || "User",
        userEmail: current.email || undefined,
        details: "User signed out",
      });
    }
    await signOut(auth);
  }, [profile]);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!auth.currentUser) throw new Error("Not authenticated");
    await updatePassword(auth.currentUser, newPassword);
    await logActivity({
      action: "Password Change",
      entityType: "user",
      entityId: auth.currentUser.uid,
      userId: auth.currentUser.uid,
      userName: profile?.displayName || "User",
      userEmail: auth.currentUser.email || undefined,
      details: "Password updated",
    });
  }, [profile]);

  const hasPermission = useCallback(
    (permission: keyof (typeof ROLE_PERMISSIONS)[UserRole]) => {
      if (!profile) return false;
      return ROLE_PERMISSIONS[profile.role]?.[permission] ?? false;
    },
    [profile]
  );

  const isRole = useCallback(
    (...roles: UserRole[]) => {
      if (!profile) return false;
      return roles.includes(profile.role);
    },
    [profile]
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      login,
      logout,
      resetPassword,
      changePassword,
      refreshProfile,
      hasPermission,
      isRole,
    }),
    [
      user,
      profile,
      loading,
      login,
      logout,
      resetPassword,
      changePassword,
      refreshProfile,
      hasPermission,
      isRole,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
