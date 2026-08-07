"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FirebaseError } from "firebase/app";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { BrandLogo } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  remember: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function getLoginErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Email ya password galat hai. Dubara check karein.";
      case "auth/invalid-email":
        return "Email format sahi nahi hai.";
      case "auth/user-disabled":
        return "Ye account disable hai. Admin se contact karein.";
      case "auth/too-many-requests":
        return "Bahut zyada attempts. Thodi der baad try karein.";
      case "auth/network-request-failed":
        return "Internet connection check karein.";
      case "permission-denied":
        return "Firestore permission denied. Firebase rules deploy karein.";
      default:
        return error.message;
    }
  }
  if (error instanceof Error) return error.message;
  return "Login failed. Please try again.";
}

export function LoginForm() {
  const { login, user, profile, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      remember: true,
    },
  });

  useEffect(() => {
    if (!loading && user && profile) {
      router.replace(params.get("next") || "/dashboard");
    }
  }, [loading, user, profile, router, params]);

  useEffect(() => {
    if (params.get("error") === "inactive") {
      toast.error("Your account is inactive. Contact the administrator.");
    }
  }, [params]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await login(values.email.trim(), values.password, values.remember);
      toast.success("Welcome back");
      router.replace(params.get("next") || "/dashboard");
    } catch (err) {
      toast.error(getLoginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ffffff_100%)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_#1e3a8a_0%,_#0f172a_50%,_#020617_100%)]">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(37_99_235/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(37_99_235/0.04)_1px,transparent_1px)] bg-size-[28px_28px]" />
      <Card className="relative z-10 w-full max-w-md rounded-3xl border-border/70 soft-shadow">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto overflow-hidden rounded-2xl bg-black shadow-sm">
            <BrandLogo className="h-20 w-20" priority />
          </div>
          <div>
            <CardTitle className="text-2xl">{APP_NAME}</CardTitle>
            <CardDescription className="mt-1">
              Sign in to your laboratory workspace
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="h-11 rounded-xl"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-11 rounded-xl"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={form.watch("remember")}
                onCheckedChange={(checked) =>
                  form.setValue("remember", checked === true)
                }
              />
              <Label htmlFor="remember" className="font-normal">
                Remember me
              </Label>
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-base"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center text-center text-xs text-muted-foreground">
          Use your Firebase email/password account. First login creates your LIMS
          profile automatically.
        </CardFooter>
      </Card>
    </div>
  );
}
