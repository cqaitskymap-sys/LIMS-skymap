"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { COLLECTIONS } from "@/lib/constants";
import { listDocumentsSafe } from "@/lib/firebase/firestore";
import { useDebouncedValue } from "@/hooks/use-firestore";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, PageShell, TableSkeleton } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Customer, LabTest, Product, Report, Sample } from "@/types";

function SearchContent() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const debounced = useDebouncedValue(query, 350);
  const [loading, setLoading] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    setQuery(params.get("q") || "");
  }, [params]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (debounced.trim().length < 2) {
        setSamples([]);
        setTests([]);
        setReports([]);
        setProducts([]);
        setCustomers([]);
        return;
      }
      setLoading(true);
      try {
        const [s, t, r, p, c] = await Promise.all([
          listDocumentsSafe<Sample>(COLLECTIONS.samples),
          listDocumentsSafe<LabTest>(COLLECTIONS.tests),
          listDocumentsSafe<Report>(COLLECTIONS.reports),
          listDocumentsSafe<Product>(COLLECTIONS.products),
          listDocumentsSafe<Customer>(COLLECTIONS.customers),
        ]);
        if (!active) return;
        const q = debounced.toLowerCase();
        setSamples(
          s.filter(
            (x) =>
              x.sampleNumber.toLowerCase().includes(q) ||
              (x.productName || "").toLowerCase().includes(q) ||
              (x.batchNumber || "").toLowerCase().includes(q)
          )
        );
        setTests(
          t.filter(
            (x) =>
              x.testNumber.toLowerCase().includes(q) ||
              x.testName.toLowerCase().includes(q) ||
              x.sampleNumber.toLowerCase().includes(q)
          )
        );
        setReports(
          r.filter(
            (x) =>
              x.reportNumber.toLowerCase().includes(q) ||
              x.title.toLowerCase().includes(q)
          )
        );
        setProducts(
          p.filter(
            (x) =>
              x.name.toLowerCase().includes(q) ||
              x.code.toLowerCase().includes(q)
          )
        );
        setCustomers(
          c.filter(
            (x) =>
              x.name.toLowerCase().includes(q) ||
              x.code.toLowerCase().includes(q)
          )
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [debounced]);

  const total = useMemo(
    () =>
      samples.length +
      tests.length +
      reports.length +
      products.length +
      customers.length,
    [samples, tests, reports, products, customers]
  );

  return (
    <PageShell>
      <PageHeader
        title="Search Everywhere"
        description="Instant debounced search across samples, tests, reports, and masters."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Search" },
        ]}
      />
      <div className="relative mb-6 max-w-2xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 rounded-2xl pl-10 text-base"
          placeholder="Type at least 2 characters..."
          autoFocus
        />
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : debounced.trim().length < 2 ? (
        <EmptyState
          title="Start typing to search"
          description="Search sample numbers, tests, products, customers, and reports."
        />
      ) : total === 0 ? (
        <EmptyState title="No matches found" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ResultCard title="Samples" href="/samples" items={samples.map((s) => ({ id: s.id, label: s.sampleNumber, meta: s.productName }))} />
          <ResultCard title="Tests" href="/testing" items={tests.map((t) => ({ id: t.id, label: t.testNumber, meta: t.testName }))} />
          <ResultCard title="Reports" href="/reports" items={reports.map((r) => ({ id: r.id, label: r.reportNumber, meta: r.title }))} />
          <ResultCard title="Products" href="/masters/products" items={products.map((p) => ({ id: p.id, label: p.name, meta: p.code }))} />
          <ResultCard title="Customers" href="/masters/customers" items={customers.map((c) => ({ id: c.id, label: c.name, meta: c.code }))} />
        </div>
      )}
    </PageShell>
  );
}

function ResultCard({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: { id: string; label: string; meta?: string }[];
}) {
  if (!items.length) return null;
  return (
    <Card className="rounded-2xl soft-shadow">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">
          {title} ({items.length})
        </CardTitle>
        <Link href={href} className="text-sm text-primary hover:underline">
          Open
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.slice(0, 8).map((item) => (
          <Link
            key={item.id}
            href={href}
            className="block rounded-xl border px-3 py-2 transition hover:bg-muted/40"
          >
            <p className="text-sm font-medium">{item.label}</p>
            {item.meta && (
              <p className="text-xs text-muted-foreground">{item.meta}</p>
            )}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <TableSkeleton />
        </PageShell>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
