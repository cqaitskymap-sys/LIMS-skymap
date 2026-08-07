import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}
