"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { BrandLogo } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await resetPassword(values.email);
      setSent(true);
      toast.success("Password reset email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to send reset email");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#ffffff_55%)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_#1e3a8a_0%,_#020617_60%)]">
      <Card className="w-full max-w-md rounded-3xl soft-shadow">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto overflow-hidden rounded-2xl bg-black shadow-sm">
            <BrandLogo className="h-16 w-16" priority />
          </div>
          <div>
            <CardTitle>Reset password</CardTitle>
            <CardDescription className="mt-1">
              Enter your account email and we will send a reset link.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                Check your inbox for the password reset link.
              </p>
              <Button asChild className="w-full rounded-xl">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  className="h-11 rounded-xl"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="h-11 w-full rounded-xl"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/login">
                  <ArrowLeft className="mr-2 size-4" />
                  Back to sign in
                </Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
