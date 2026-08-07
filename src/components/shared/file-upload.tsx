"use client";

import { useCallback, useState, type ReactNode } from "react";
import { FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FileUpload({
  accept = "image/*,application/pdf",
  multiple = true,
  onFiles,
  files,
  onRemove,
}: {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  files?: { id: string; name: string; size?: number }[];
  onRemove?: (id: string) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      onFiles(Array.from(list));
    },
    [onFiles]
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 px-4 py-10 text-center transition",
          dragging && "border-primary bg-primary/5"
        )}
      >
        <FileUp className="mb-3 size-8 text-primary" />
        <p className="text-sm font-medium">Drag & drop files here</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, images, and documents supported
        </p>
        <label className="mt-4">
          <input
            type="file"
            className="hidden"
            accept={accept}
            multiple={multiple}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button type="button" variant="outline" asChild>
            <span>Browse files</span>
          </Button>
        </label>
      </div>
      {files && files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm"
            >
              <span className="truncate">{file.name}</span>
              {onRemove && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onRemove(file.id)}
                >
                  <X className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card soft-shadow">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
