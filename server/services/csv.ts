/** CSV output that is safe to open in spreadsheets (no formula injection). */
function cell(value: unknown): string {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");
  // A leading = + - @ (or tab/CR) makes Excel/Sheets evaluate the cell as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
