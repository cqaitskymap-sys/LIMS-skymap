import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadBlob, toCsv } from "@/lib/utils";

export function exportToCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[]
) {
  const csv = toCsv(
    rows,
    columns.map((c) => c.key)
  );
  const labeledHeader = columns.map((c) => c.label).join(",");
  const body = csv.split("\n").slice(1).join("\n");
  const blob = new Blob([`${labeledHeader}\n${body}`], {
    type: "text/csv;charset=utf-8;",
  });
  downloadBlob(blob, `${filename}.csv`);
}

export function exportToExcel(
  filename: string,
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[]
) {
  const data = rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    columns.forEach((col) => {
      mapped[col.label] = row[col.key] ?? "";
    });
    return mapped;
  });
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToPdf(
  title: string,
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  filename?: string
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ""))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`${filename || title.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}
