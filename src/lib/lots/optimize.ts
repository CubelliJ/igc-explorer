import {
  copyLot,
  type CsvRow,
  type Lot,
  parseClDate,
  parseClNumber,
  ufPerCuota,
} from "./parse";
import { getUf, preloadUfYears } from "./uf";

export type Method = "FIFO" | "LIFO";

export type MethodResult = {
  method: Method;
  cuotas: number;
  proceeds: number;
  gain: number;
  takes: Array<{ lot: Lot; cuotas: number }>;
};

export type OpenLotsResult = {
  lots: Lot[];
  lastDate: Date | null;
  lastValorCuota: number | null;
};

function consume(
  lots: Lot[],
  cuotas: number,
  method: Method,
): void {
  let remaining = cuotas;
  const order =
    method === "FIFO"
      ? lots.map((_, i) => i)
      : [...lots.keys()].reverse();

  for (const idx of order) {
    if (remaining <= 1e-12) break;
    const lot = lots[idx];
    if (lot.cuotas <= 1e-12) continue;
    const use = Math.min(lot.cuotas, remaining);
    const frac = use / lot.cuotas;
    lot.pesos *= 1 - frac;
    lot.cuotas -= use;
    remaining -= use;
  }
  // compact
  for (let i = lots.length - 1; i >= 0; i--) {
    if (lots[i].cuotas <= 1e-9) lots.splice(i, 1);
  }
  if (remaining > 1e-6) {
    throw new Error(`Cuotas insuficientes (${method}): faltan ${remaining.toFixed(4)}`);
  }
}

export async function rebuildOpenLots(
  rows: CsvRow[],
  historyMethod: Method = "FIFO",
): Promise<OpenLotsResult> {
  const eventDates: Date[] = [];
  let lastDate: Date | null = null;
  let lastValorCuota: number | null = null;

  for (const r of rows) {
    const d = parseClDate(r.Fecha);
    const vc = parseClNumber(r["Valor Cuota"]);
    if (vc > 0) {
      lastDate = d;
      lastValorCuota = vc;
    }
    if (
      parseClNumber(r["Aporte Cuotas"]) > 1e-12 ||
      parseClNumber(r["Rescate Cuotas"]) > 1e-12
    ) {
      eventDates.push(d);
    }
  }
  if (lastDate) eventDates.push(lastDate);

  const years = eventDates.map((d) => d.getFullYear());
  years.push(new Date().getFullYear());
  await preloadUfYears(years, eventDates);

  const lots: Lot[] = [];
  for (const r of rows) {
    const d = parseClDate(r.Fecha);
    const vc = parseClNumber(r["Valor Cuota"]);
    const aporteC = parseClNumber(r["Aporte Cuotas"]);
    const rescateC = parseClNumber(r["Rescate Cuotas"]);
    const aporteP = parseClNumber(r["Aporte Pesos Chilenos"]);

    if (aporteC > 1e-12) {
      const pesos = aporteP > 0 ? aporteP : aporteC * vc;
      const uf = await getUf(d);
      lots.push({
        date: d,
        cuotas: aporteC,
        pesos,
        investment: (r["Nombre Inversión"] || "").trim(),
        uf,
      });
    }
    if (rescateC > 1e-12) {
      consume(lots, rescateC, historyMethod);
    }
  }

  return {
    lots: lots.map(copyLot),
    lastDate,
    lastValorCuota,
  };
}

export function lotsOrdered(lots: Lot[], method: Method): Lot[] {
  return method === "FIFO" ? [...lots] : [...lots].reverse();
}

export function gainForSale(
  orderedLots: Lot[],
  cuotasToSell: number,
  valorCuota: number,
  ufSale: number,
): { proceeds: number; gain: number; takes: Array<{ lot: Lot; cuotas: number }> } {
  let remaining = cuotasToSell;
  let costUf = 0;
  const takes: Array<{ lot: Lot; cuotas: number }> = [];

  for (const lot of orderedLots) {
    if (remaining <= 1e-12) break;
    if (lot.cuotas <= 1e-12) continue;
    const use = Math.min(lot.cuotas, remaining);
    takes.push({ lot: copyLot(lot), cuotas: use });
    costUf += ufPerCuota(lot) * use;
    remaining -= use;
  }
  if (remaining > 1e-6) throw new Error("Cuotas insuficientes en lotes abiertos");

  const proceeds = cuotasToSell * valorCuota;
  const saleUf = proceeds / ufSale;
  const gain = (saleUf - costUf) * ufSale;
  return { proceeds, gain, takes };
}

export function maxSaleUnderGainCap(
  openLots: Lot[],
  method: Method,
  valorCuota: number,
  ufSale: number,
  maxGain: number,
): MethodResult {
  const working = lotsOrdered(openLots, method).map(copyLot);
  let soldCuotas = 0;
  let cumProceeds = 0;
  let cumGain = 0;
  const takes: Array<{ lot: Lot; cuotas: number }> = [];

  for (const lot of working) {
    if (lot.cuotas <= 1e-12) continue;
    const mGain = valorCuota - ufPerCuota(lot) * ufSale;
    let use: number;
    if (mGain <= 1e-9) {
      use = lot.cuotas;
    } else {
      const room = maxGain - cumGain;
      if (room <= 1e-6) break;
      use = Math.min(lot.cuotas, room / mGain);
    }
    if (use <= 1e-12) break;

    const part = gainForSale([lot], use, valorCuota, ufSale);
    soldCuotas += use;
    cumProceeds += part.proceeds;
    cumGain += part.gain;
    takes.push(...part.takes);
    lot.cuotas -= use;

    if (mGain > 1e-9 && lot.cuotas > 1e-9) break;
  }

  return {
    method,
    cuotas: soldCuotas,
    proceeds: cumProceeds,
    gain: cumGain,
    takes,
  };
}

export function filterLotsByInvestment(lots: Lot[], investment: string): Lot[] {
  const key = investment.trim().toLowerCase();
  return lots.filter((l) => l.investment.trim().toLowerCase() === key);
}
