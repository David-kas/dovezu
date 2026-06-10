import * as XLSX from "xlsx";

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  sheetName: string,
  _filename: string
): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
