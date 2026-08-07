"use client";

import { useEffect, useMemo, useState } from "react";
import { listDocumentsSafe } from "@/lib/firebase/firestore";
import type { BaseEntity } from "@/types";

export function useCollection<T extends BaseEntity>(
  collectionName: string,
  refreshKey = 0
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listDocumentsSafe<T>(collectionName)
      .then((rows) => {
        if (active) setData(rows);
      })
      .catch((err: Error) => {
        if (active) setError(err.message || "Failed to load data");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [collectionName, refreshKey]);

  const activeOnly = useMemo(
    () => data.filter((row) => row.isActive !== false),
    [data]
  );

  return { data, activeOnly, loading, error, setData };
}

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  return {
    page: currentPage,
    setPage,
    totalPages,
    pageItems,
    total: items.length,
  };
}
