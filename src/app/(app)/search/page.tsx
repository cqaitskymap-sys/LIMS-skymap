"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-firestore";
import {
  buildSearchResults,
  fetchSearchCatalog,
  MIN_SEARCH_LENGTH,
  SEARCH_FETCH_LIMIT,
  SEARCH_RESULT_PREVIEW,
  type SearchCatalog,
} from "@/lib/search";
import { PageHeader } from "@/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  PageShell,
  TableSkeleton,
} from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SearchContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const debounced = useDebouncedValue(query, 350);
  const [catalog, setCatalog] = useState<SearchCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setQuery(params.get("q") || "");
  }, [params]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchSearchCatalog()
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message || "Failed to load search data");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    const next = debounced.trim();
    const current = params.get("q") || "";
    if (next === current) return;
    if (next.length >= MIN_SEARCH_LENGTH) {
      router.replace(`/search?q=${encodeURIComponent(next)}`, { scroll: false });
    } else if (current) {
      router.replace("/search", { scroll: false });
    }
  }, [debounced, params, router]);

  const resultGroups = useMemo(() => {
    if (!catalog || debounced.trim().length < MIN_SEARCH_LENGTH) return [];
    return buildSearchResults(catalog, debounced);
  }, [catalog, debounced]);

  const total = useMemo(
    () => resultGroups.reduce((sum, group) => sum + group.items.length, 0),
    [resultGroups]
  );

  const isTruncated =
    !!catalog &&
    (catalog.samples.length >= SEARCH_FETCH_LIMIT ||
      catalog.tests.length >= SEARCH_FETCH_LIMIT ||
      catalog.reports.length >= SEARCH_FETCH_LIMIT);

  return (
    <PageShell>
      <PageHeader
        title="Search Everywhere"
        description="Search across samples, tests, reports, and master data."
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

      {isTruncated && debounced.trim().length >= MIN_SEARCH_LENGTH && (
        <p className="mb-4 text-sm text-muted-foreground">
          Results may be incomplete — search indexes the latest{" "}
          {SEARCH_FETCH_LIMIT.toLocaleString()} records per module.
        </p>
      )}

      {loading ? (
        <TableSkeleton rows={4} />
      ) : error ? (
        <ErrorState
          title="Failed to load search"
          description={error}
          onRetry={() => setRefreshKey((k) => k + 1)}
        />
      ) : debounced.trim().length < MIN_SEARCH_LENGTH ? (
        <EmptyState
          title="Start typing to search"
          description="Search sample numbers, tests, reports, products, customers, materials, instruments, and other master records."
        />
      ) : total === 0 ? (
        <EmptyState
          title="No matches found"
          description={`No results for "${debounced.trim()}". Try another keyword.`}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {resultGroups.map((group) => (
            <ResultCard key={group.title} {...group} query={debounced.trim()} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function ResultCard({
  title,
  href,
  items,
  query,
}: {
  title: string;
  href: string;
  items: { id: string; label: string; meta?: string }[];
  query: string;
}) {
  const moduleHref = `${href}?q=${encodeURIComponent(query)}`;

  return (
    <Card className="rounded-2xl soft-shadow">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">
          {title} ({items.length})
        </CardTitle>
        <Link href={moduleHref} className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.slice(0, SEARCH_RESULT_PREVIEW).map((item) => (
          <Link
            key={item.id}
            href={moduleHref}
            className="block rounded-xl border px-3 py-2 transition hover:bg-muted/40"
          >
            <p className="text-sm font-medium">{item.label}</p>
            {item.meta && (
              <p className="text-xs text-muted-foreground">{item.meta}</p>
            )}
          </Link>
        ))}
        {items.length > SEARCH_RESULT_PREVIEW && (
          <p className="pt-1 text-xs text-muted-foreground">
            +{items.length - SEARCH_RESULT_PREVIEW} more in {title}
          </p>
        )}
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
