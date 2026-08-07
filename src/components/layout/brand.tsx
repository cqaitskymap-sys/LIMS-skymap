"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/skymap-logo.png"
      alt="SKYMAP"
      width={512}
      height={512}
      priority={priority}
      className={cn("object-contain", className)}
    />
  );
}

export function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg bg-black shadow-sm",
          collapsed ? "size-8" : "size-9"
        )}
      >
        <BrandLogo className="size-full" />
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold tracking-tight">
            {APP_NAME}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            Pharma Laboratory
          </span>
        </div>
      )}
    </Link>
  );
}
