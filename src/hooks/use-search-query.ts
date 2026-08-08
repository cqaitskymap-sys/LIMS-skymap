"use client";

import { useEffect } from "react";

export function useSearchQueryParam(setSearch: (value: string) => void) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearch(q);
  }, [setSearch]);
}
