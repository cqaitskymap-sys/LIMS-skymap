import { Suspense } from "react";
import type { Metadata } from "next";
import TestingPage from "./testing-client";
import { TableSkeleton } from "@/components/shared/states";
import { PageShell } from "@/components/shared/states";

export const metadata: Metadata = {
  title: "Testing",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <TableSkeleton />
        </PageShell>
      }
    >
      <TestingPage />
    </Suspense>
  );
}
