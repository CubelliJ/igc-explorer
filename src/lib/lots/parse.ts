export type CsvRow = Record<string, string>;

export type Lot = {
  date: Date; // local calendar date
  cuotas: number;
  pesos: number;
  investment: string;
  uf: number;
};

export function parseClNumber(value: string | undefined | null): number {
  if (value == null) return 0;
  let s = String(value).trim().replace(/\$/g, "").replace(/"/g, "").replace(/\s/g, "");
  if (!s) return 0;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(".")) {
    const parts = s.split(".");
    if (parts.every((p) => /^\d+$/.test(p))) {
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        s = parts.join("");
      }
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseClDate(value: string): Date {
  const [dd, mm, yyyy] = value.trim().split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function copyLot(lot: Lot): Lot {
  return { ...lot, date: new Date(lot.date.getTime()) };
}

export function ufPerCuota(lot: Lot): number {
  if (!lot.cuotas || !lot.uf) return 0;
  return lot.pesos / lot.uf / lot.cuotas;
}

export function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function filterFondoSerie(
  rows: CsvRow[],
  fondo: string,
  serie: string,
): CsvRow[] {
  return rows
    .filter(
      (r) =>
        (r["Nombre Fondo"] || "").trim() === fondo &&
        (r["Serie Fondo"] || "").trim() === serie,
    )
    .sort((a, b) => {
      const da = parseClDate(a.Fecha).getTime();
      const db = parseClDate(b.Fecha).getTime();
      if (da !== db) return da - db;
      return (a.Hora || "").localeCompare(b.Hora || "");
    });
}

export function listFondosSeries(rows: CsvRow[]): Array<{ fondo: string; serie: string }> {
  const set = new Map<string, { fondo: string; serie: string }>();
  for (const r of rows) {
    const fondo = (r["Nombre Fondo"] || "").trim();
    const serie = (r["Serie Fondo"] || "").trim();
    if (!fondo) continue;
    const key = `${fondo}||${serie}`;
    set.set(key, { fondo, serie });
  }
  return [...set.values()].sort((a, b) =>
    `${a.fondo} ${a.serie}`.localeCompare(`${b.fondo} ${b.serie}`),
  );
}
