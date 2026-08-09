import { dateKey } from "./parse";

const YEAR_CACHE = new Map<number, Map<string, number>>();
const DAY_CACHE = new Map<string, number>();
const BAD_YEARS = new Set<number>();

function isoDatePrefix(fecha: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(fecha);
  return m ? m[1] : null;
}

async function fetchYear(year: number): Promise<Map<string, number>> {
  if (YEAR_CACHE.has(year)) return YEAR_CACHE.get(year)!;
  if (BAD_YEARS.has(year)) return new Map();

  const res = await fetch(`https://mindicador.cl/api/uf/${year}`);
  if (!res.ok) throw new Error(`UF ${year}: HTTP ${res.status}`);
  const payload = (await res.json()) as {
    serie?: Array<{ fecha: string; valor: number }>;
  };
  const map = new Map<string, number>();
  for (const item of payload.serie ?? []) {
    const key = isoDatePrefix(item.fecha);
    if (!key) continue;
    // mindicador sometimes returns the wrong year payload (e.g. 2024 → mid-2026).
    if (!key.startsWith(`${year}-`)) continue;
    map.set(key, Number(item.valor));
  }

  if (map.size < 50) {
    BAD_YEARS.add(year);
    YEAR_CACHE.set(year, new Map());
    return YEAR_CACHE.get(year)!;
  }

  YEAR_CACHE.set(year, map);
  return map;
}

async function fetchDay(d: Date): Promise<number | null> {
  const key = dateKey(d);
  if (DAY_CACHE.has(key)) return DAY_CACHE.get(key)!;

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const res = await fetch(`https://mindicador.cl/api/uf/${dd}-${mm}-${yyyy}`);
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    serie?: Array<{ fecha: string; valor: number }>;
  };
  const item = payload.serie?.[0];
  if (!item) return null;
  const valor = Number(item.valor);
  if (!Number.isFinite(valor)) return null;
  DAY_CACHE.set(key, valor);
  // also stash into year map for reuse
  const yearMap = YEAR_CACHE.get(yyyy) ?? new Map<string, number>();
  yearMap.set(key, valor);
  YEAR_CACHE.set(yyyy, yearMap);
  return valor;
}

export async function preloadUfYears(
  years: number[],
  dates: Date[] = [],
): Promise<void> {
  const unique = [...new Set(years)];
  await Promise.all(unique.map((y) => fetchYear(y)));

  // Warm daily lookups for years where the bulk endpoint is incomplete/wrong.
  const needDay = dates.filter((d) => BAD_YEARS.has(d.getFullYear()));
  const keys = new Set(needDay.map(dateKey));
  const uniqueDays = [...keys].map((k) => {
    const [y, m, day] = k.split("-").map(Number);
    return new Date(y, m - 1, day);
  });
  const chunk = 12;
  for (let i = 0; i < uniqueDays.length; i += chunk) {
    await Promise.all(uniqueDays.slice(i, i + chunk).map((d) => fetchDay(d)));
  }
}

export async function getUf(d: Date): Promise<number> {
  let cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  for (let i = 0; i < 14; i++) {
    const yearMap = await fetchYear(cursor.getFullYear());
    const key = dateKey(cursor);
    const fromYear = yearMap.get(key);
    if (fromYear != null) return fromYear;

    const fromDay = await fetchDay(cursor);
    if (fromDay != null) return fromDay;

    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  throw new Error(`Sin UF cerca de ${dateKey(d)}`);
}
