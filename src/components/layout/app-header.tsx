"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  LogOut,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ThemeToggle } from "@/components/layout/brand";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/constants";
import { MIN_SEARCH_LENGTH } from "@/lib/search";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";

function GlobalSearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (pathname === "/search") {
      setQuery(params.get("q") || "");
    }
  }, [pathname, params]);

  const submitSearch = () => {
    const q = query.trim();
    if (q.length >= MIN_SEARCH_LENGTH) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
      return;
    }
    router.push("/search");
  };

  return (
    <div className="relative hidden min-w-0 flex-1 sm:block md:max-w-md lg:max-w-lg">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submitSearch();
        }}
        placeholder="Search samples, tests, reports..."
        className="h-10 rounded-xl bg-muted/40 pl-9"
        aria-label="Global search"
      />
    </div>
  );
}

export function AppHeader() {
  const router = useRouter();
  const { profile, logout } = useAuth();
  const unread = useUnreadNotificationCount(profile?.uid);

  const initials = useMemo(() => {
    const name = profile?.displayName || "U";
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [profile?.displayName]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/80 bg-background/90 px-3 backdrop-blur md:px-5">
      <SidebarTrigger className="shrink-0" />
      <Suspense
        fallback={
          <div className="relative hidden min-w-0 flex-1 sm:block md:max-w-md lg:max-w-lg">
            <Input
              disabled
              placeholder="Search samples, tests, reports..."
              className="h-10 rounded-xl bg-muted/40 pl-9"
            />
          </div>
        }
      >
        <GlobalSearchInput />
      </Suspense>
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label="Search"
          onClick={() => router.push("/search")}
        >
          <Search className="size-4" />
        </Button>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
          asChild
        >
          <Link href="/notifications">
            <Bell className="size-4" />
            {unread > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
                {unread > 9 ? "9+" : unread}
              </Badge>
            )}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 rounded-xl px-2">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden min-w-0 text-left md:block">
                <p className="truncate text-sm font-medium leading-none">
                  {profile?.displayName || "User"}
                </p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {profile ? ROLE_LABELS[profile.role] : "—"}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <UserRound className="mr-2 size-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
