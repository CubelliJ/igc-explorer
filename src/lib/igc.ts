/** AT2026 Art. 52 — edges in CLP millions */
export const BRACKETS = [
  { lo: 0, hi: 11.265804, rate: 0, label: "0%" },
  { lo: 11.265804, hi: 25.03512, rate: 0.04, label: "4%" },
  { lo: 25.03512, hi: 41.7252, rate: 0.08, label: "8%" },
  { lo: 41.7252, hi: 58.41528, rate: 0.135, label: "13.5%" },
  { lo: 58.41528, hi: 75.10536, rate: 0.23, label: "23%" },
  { lo: 75.10536, hi: 100.14048, rate: 0.304, label: "30.4%" },
  { lo: 100.14048, hi: 258.69624, rate: 0.35, label: "35%" },
  { lo: 258.69624, hi: 400, rate: 0.4, label: "40%" },
] as const;

export const BRACKET_COLORS = [
  "#9eb6c4",
  "#2f8f86",
  "#c9852c",
  "#c45c4a",
  "#5b6db5",
  "#3d7a8c",
  "#a33d5a",
  "#6b7c88",
] as const;

export const UTA_M = 0.834504;
export const ART57_EXEMPT_M = 30 * (UTA_M / 12);
export const MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export function formatM(m: number): string {
  const abs = Math.abs(m);
  return `$${abs >= 100 ? m.toFixed(1) : m.toFixed(2)}M`;
}

export function formatClp(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

export function igc(incomeM: number): number {
  let tax = 0;
  for (const b of BRACKETS) {
    if (incomeM <= b.lo) break;
    tax += (Math.min(b.hi, incomeM) - b.lo) * b.rate;
  }
  return tax;
}

export function marginalRate(incomeM: number): number {
  for (const b of BRACKETS) {
    if (incomeM > b.lo && incomeM <= b.hi) return b.rate;
  }
  return BRACKETS[BRACKETS.length - 1].rate;
}

export function bracketLabel(incomeM: number): string {
  for (const b of BRACKETS) {
    if (incomeM > b.lo && incomeM <= b.hi) return b.label;
  }
  return BRACKETS[BRACKETS.length - 1].label;
}

export function annualSalary(
  monthlyM: number,
  raiseM: number,
  raiseFrom: number,
  bonusM: number,
  bonusMonth: number,
): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) {
    const base = m >= raiseFrom ? raiseM : monthlyM;
    total += base + (m === bonusMonth ? bonusM : 0);
  }
  return total;
}

export type BracketRow = {
  label: string;
  rate: number;
  color: string;
  salaryTaxM: number;
  fundTaxM: number;
};

export function decompose(salaryM: number, fundM: number): BracketRow[] {
  const totalM = salaryM + fundM;
  return BRACKETS.map((b, i) => {
    const salW = Math.max(0, Math.min(b.hi, salaryM) - Math.max(b.lo, 0));
    const totW = Math.max(0, Math.min(b.hi, totalM) - Math.max(b.lo, 0));
    const fundW = Math.max(0, totW - salW);
    return {
      label: b.label,
      rate: b.rate,
      color: BRACKET_COLORS[i],
      salaryTaxM: salW * b.rate,
      fundTaxM: fundW * b.rate,
    };
  }).filter((r) => r.salaryTaxM > 0.0005 || r.fundTaxM > 0.0005);
}
