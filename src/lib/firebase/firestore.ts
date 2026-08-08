import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type WithFieldValue,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/constants";
import type {
  ActivityLog,
  AppNotification,
  AuditTrailEntry,
  BaseEntity,
} from "@/types";

export function nowIso() {
  return new Date().toISOString();
}

export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const next = { ...obj };
  Object.keys(next).forEach((key) => {
    if (next[key] === undefined) delete next[key];
  });
  return next;
}

function mapDoc<T extends BaseEntity>(id: string, data: DocumentData): T {
  return {
    id,
    ...data,
    createdAt: data.createdAt || nowIso(),
    updatedAt: data.updatedAt || nowIso(),
  } as T;
}

export async function getById<T extends BaseEntity>(
  collectionName: string,
  id: string
): Promise<T | null> {
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  return mapDoc<T>(snap.id, snap.data());
}

const DEFAULT_LIST_LIMIT = 500;

export async function listDocuments<T extends BaseEntity>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  maxDocs = DEFAULT_LIST_LIMIT
): Promise<T[]> {
  const q = query(
    collection(db, collectionName),
    ...constraints,
    orderBy("updatedAt", "desc"),
    limit(maxDocs)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc<T>(d.id, d.data()));
}

export async function listDocumentsSafe<T extends BaseEntity>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  maxDocs = DEFAULT_LIST_LIMIT
): Promise<T[]> {
  try {
    return await listDocuments<T>(collectionName, constraints, maxDocs);
  } catch {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs
      .map((d) => mapDoc<T>(d.id, d.data()))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, maxDocs);
  }
}

export async function createDocument<T extends Record<string, unknown>>(
  collectionName: string,
  data: T,
  id?: string
): Promise<string> {
  const payload = stripUndefined({
    ...data,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    isActive: data.isActive ?? true,
  });

  if (id) {
    await setDoc(doc(db, collectionName, id), payload as WithFieldValue<DocumentData>);
    return id;
  }
  const refDoc = await addDoc(
    collection(db, collectionName),
    payload as WithFieldValue<DocumentData>
  );
  return refDoc.id;
}

export async function updateDocument(
  collectionName: string,
  id: string,
  data: Record<string, unknown>
) {
  await updateDoc(doc(db, collectionName, id), {
    ...stripUndefined(data),
    updatedAt: nowIso(),
  });
}

export async function softDeleteDocument(collectionName: string, id: string) {
  await updateDocument(collectionName, id, { isActive: false });
}

export async function hardDeleteDocument(collectionName: string, id: string) {
  await deleteDoc(doc(db, collectionName, id));
}

export async function logActivity(
  activity: Omit<ActivityLog, "id" | "createdAt" | "updatedAt">
) {
  await createDocument(COLLECTIONS.activities, activity);
}

export async function logAudit(
  entry: Omit<AuditTrailEntry, "id" | "createdAt" | "updatedAt">
) {
  await createDocument(COLLECTIONS.auditTrail, entry);
}

export async function createNotification(
  notification: Omit<AppNotification, "id" | "createdAt" | "updatedAt" | "isRead">
) {
  await createDocument(COLLECTIONS.notifications, {
    ...notification,
    isRead: false,
  });
}

export async function uploadFile(
  path: string,
  file: File
): Promise<{ url: string; path: string }> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, path };
}

export async function deleteFile(path: string) {
  await deleteObject(ref(storage, path));
}

export async function getNextSequence(counterName: string, prefix: string) {
  const counterRef = doc(db, COLLECTIONS.counters, counterName);
  const snap = await getDoc(counterRef);
  const current = snap.exists() ? Number(snap.data().value || 0) : 0;
  const next = current + 1;
  await setDoc(
    counterRef,
    { value: next, updatedAt: serverTimestamp() },
    { merge: true }
  );
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(next).padStart(5, "0")}`;
}

export { where, orderBy, limit, query, collection, doc };
