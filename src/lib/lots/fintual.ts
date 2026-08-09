/** Public Fintual market data API (no auth). Docs: https://fintual.cl/api-docs/index.html */

const API = "https://fintual.cl/api";

type JsonApiList<T> = { data: T[] };

type ConceptualAsset = {
  id: string;
  type: "conceptual_asset";
  attributes: {
    name: string;
    symbol: string;
    category: string;
    currency: string;
  };
};

type RealAsset = {
  id: string;
  type: "real_asset";
  attributes: {
    name: string;
    symbol: string;
    serie: string;
    conceptual_asset_id: number;
    last_day: {
      net_asset_value: number;
      date: string; // YYYY-MM-DD
    } | null;
  };
};

export type FintualQuote = {
  fondo: string;
  serie: string;
  realAssetId: string;
  valorCuota: number;
  date: Date;
  dateKey: string;
};

let conceptualCache: ConceptualAsset[] | null = null;

async function getConceptualAssets(): Promise<ConceptualAsset[]> {
  if (conceptualCache) return conceptualCache;
  const res = await fetch(`${API}/conceptual_assets`);
  if (!res.ok) throw new Error(`Fintual conceptual_assets: HTTP ${res.status}`);
  const payload = (await res.json()) as JsonApiList<ConceptualAsset>;
  conceptualCache = payload.data ?? [];
  return conceptualCache;
}

function parseApiDate(isoDay: string): Date {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Live valor cuota for a Fintual fund name + serie (e.g. "Risky Norris", "A").
 * Matches conceptual asset by exact name (case-insensitive).
 */
export async function fetchFintualQuote(
  fondo: string,
  serie: string,
): Promise<FintualQuote> {
  const nameKey = fondo.trim().toLowerCase();
  const serieKey = serie.trim().toLowerCase();
  if (!nameKey) throw new Error("Nombre de fondo vacío");

  const conceptuals = await getConceptualAssets();
  const conceptual =
    conceptuals.find((c) => c.attributes.name.trim().toLowerCase() === nameKey) ??
    conceptuals.find((c) =>
      c.attributes.name.trim().toLowerCase().includes(nameKey),
    );

  if (!conceptual) {
    throw new Error(`Fintual no tiene el fondo “${fondo}”`);
  }

  const res = await fetch(`${API}/conceptual_assets/${conceptual.id}/real_assets`);
  if (!res.ok) throw new Error(`Fintual real_assets: HTTP ${res.status}`);
  const payload = (await res.json()) as JsonApiList<RealAsset>;
  const reals = payload.data ?? [];

  const real =
    reals.find((r) => r.attributes.serie.trim().toLowerCase() === serieKey) ??
    (serieKey === "" || serieKey === "a"
      ? reals.find((r) => r.attributes.serie.trim().toLowerCase() === "a")
      : undefined);

  if (!real) {
    const series = reals.map((r) => r.attributes.serie).join(", ") || "(ninguna)";
    throw new Error(
      `Fintual: sin serie “${serie}” para ${conceptual.attributes.name}. Series: ${series}`,
    );
  }

  const last = real.attributes.last_day;
  if (!last?.net_asset_value || !last.date) {
    throw new Error(`Fintual: sin last_day para ${real.attributes.symbol}`);
  }

  return {
    fondo: conceptual.attributes.name,
    serie: real.attributes.serie,
    realAssetId: real.id,
    valorCuota: Number(last.net_asset_value),
    date: parseApiDate(last.date),
    dateKey: last.date,
  };
}
