import { initializeApp, getApp, getApps, deleteApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export async function createAuthUser(email: string, password: string) {
  const secondary =
    getApps().find((app) => app.name === "Secondary") ||
    initializeApp(firebaseConfig, "Secondary");
  const secondaryAuth = getAuth(secondary);
  const cred = await createUserWithEmailAndPassword(
    secondaryAuth,
    email,
    password
  );
  const uid = cred.user.uid;
  await secondaryAuth.signOut();
  if (getApps().some((app) => app.name === "Secondary")) {
    await deleteApp(getApp("Secondary"));
  }
  return uid;
}
