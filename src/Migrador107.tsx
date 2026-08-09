import { useMemo, useState } from "react";
import { HeadingWithTip, InfoTip } from "./components/InfoTip";
import { SliderRow } from "./components/SliderRow";
import { formatClp } from "./lib/igc";
import {
  dateKey,
  filterFondoSerie,
  listFondosSeries,
  parseCsv,
  type CsvRow,
} from "./lib/lots/parse";
import {
  filterLotsByInvestment,
  gainForSale,
  lotsOrdered,
  maxSaleUnderGainCap,
  rebuildOpenLots,
  type MethodResult,
} from "./lib/lots/optimize";
import { fetchFintualQuote } from "./lib/lots/fintual";
import { getUf } from "./lib/lots/uf";
import "./App.css";

const TIP_CSV =
  "Sube el certificado de transacciones en Fondos Mutuos (CSV). En Fintual: Certificados → Certificado de transacciones en Fondos Mutuos → CSV. El archivo no se envía a ningún servidor: todo corre en tu navegador.";

const TIP_GAIN =
  "Tope de mayor valor (ganancia ajustada por UF) que aceptas realizar este año — típicamente lo que cabe en tu tramo marginal actual (p. ej. cupo del IGC Explorer o cliff Art. 57). Así mueves plata del 108 al 107 sin saltar de banda.";

const TIP_METHOD =
  "FIFO vende primero los aportes más antiguos; LIFO, los más recientes. Fintual permite elegir al rescatar. La reconstrucción histórica de lotes abiertos usa FIFO (como el default de Fintual).";

const TIP_QUOTE =
  "Por defecto pedimos el last_day de la API pública de Fintual (valor cuota + fecha). Si falla o lo desactivas, usamos el último valor del CSV. Puedes forzar un valor manual.";

function formatCuotas(n: number): string {
  return n.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatGainShare(gain: number, proceeds: number): string {
  if (proceeds <= 0) return "—";
  return `${((100 * gain) / proceeds).toFixed(2)}%`;
}

type RunState =
  | { status: "idle" }
  | { status: "loading"; message: string }
  | { status: "error"; message: string }
  | {
      status: "done";
      fondo: string;
      serie: string;
      openLots: number;
      totalCuotas: number;
      valorCuota: number;
      lastDate: string;
      quoteSource: "fintual" | "csv" | "manual";
      csvValorCuota: number | null;
      csvDate: string | null;
      ufSale: number;
      nav: number;
      maxGain: number;
      fifo: MethodResult;
      lifo: MethodResult;
      best: "FIFO" | "LIFO";
      fullFifo: { proceeds: number; gain: number };
      fullLifo: { proceeds: number; gain: number };
    };

export function Migrador107() {
  const [rows, setRows] = useState<CsvRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fondo, setFondo] = useState("Risky Norris");
  const [serie, setSerie] = useState("A");
  const [maxGainM, setMaxGainM] = useState(1.5);
  const [investmentFilter, setInvestmentFilter] = useState("");
  const [useLiveQuote, setUseLiveQuote] = useState(true);
  const [manualValorCuota, setManualValorCuota] = useState("");
  const [run, setRun] = useState<RunState>({ status: "idle" });

  const options = useMemo(
    () => (rows ? listFondosSeries(rows) : []),
    [rows],
  );

  const investments = useMemo(() => {
    if (!rows) return [];
    const scoped = filterFondoSerie(rows, fondo, serie);
    const set = new Set<string>();
    for (const r of scoped) {
      const name = (r["Nombre Inversión"] || "").trim();
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows, fondo, serie]);

  async function onFile(file: File | null) {
    setRun({ status: "idle" });
    if (!file) {
      setRows(null);
      setFileName(null);
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) throw new Error("CSV vacío o sin filas");
      setRows(parsed);
      setFileName(file.name);
      const listed = listFondosSeries(parsed);
      const preferred =
        listed.find((x) => x.fondo === "Risky Norris" && x.serie === "A") ??
        listed[0];
      if (preferred) {
        setFondo(preferred.fondo);
        setSerie(preferred.serie);
      }
    } catch (err) {
      setRows(null);
      setFileName(null);
      setRun({
        status: "error",
        message: err instanceof Error ? err.message : "No pude leer el CSV",
      });
    }
  }

  async function optimize() {
    if (!rows) {
      setRun({ status: "error", message: "Sube el certificado CSV primero." });
      return;
    }
    const scoped = filterFondoSerie(rows, fondo, serie);
    if (!scoped.length) {
      setRun({
        status: "error",
        message: "Sin filas para ese fondo/serie.",
      });
      return;
    }

    setRun({
      status: "loading",
      message: "Reconstruyendo lotes y consultando valor cuota / UF…",
    });
    try {
      let { lots, lastDate: csvDate, lastValorCuota: csvValorCuota } =
        await rebuildOpenLots(scoped, "FIFO");
      if (investmentFilter.trim()) {
        lots = filterLotsByInvestment(lots, investmentFilter);
      }
      const totalCuotas = lots.reduce((s, l) => s + l.cuotas, 0);
      if (totalCuotas <= 1e-9) {
        throw new Error("No hay cuotas abiertas para ese filtro.");
      }

      let valorCuota: number;
      let saleDate: Date;
      let quoteSource: "fintual" | "csv" | "manual";

      const manualRaw = manualValorCuota.trim();
      const manual = manualRaw.includes(",")
        ? Number(manualRaw.replace(/\./g, "").replace(",", "."))
        : Number(manualRaw);
      if (manualRaw && Number.isFinite(manual) && manual > 0) {
        valorCuota = manual;
        saleDate = csvDate ?? new Date();
        quoteSource = "manual";
      } else if (useLiveQuote) {
        setRun({
          status: "loading",
          message: "Consultando valor cuota en Fintual…",
        });
        const quote = await fetchFintualQuote(fondo, serie);
        valorCuota = quote.valorCuota;
        saleDate = quote.date;
        quoteSource = "fintual";
      } else {
        if (!csvDate || !csvValorCuota) {
          throw new Error("No hay valor cuota de salida en el CSV.");
        }
        valorCuota = csvValorCuota;
        saleDate = csvDate;
        quoteSource = "csv";
      }

      const ufSale = await getUf(saleDate);
      const maxGain = maxGainM * 1_000_000;
      const fifo = maxSaleUnderGainCap(lots, "FIFO", valorCuota, ufSale, maxGain);
      const lifo = maxSaleUnderGainCap(lots, "LIFO", valorCuota, ufSale, maxGain);
      const best = lifo.proceeds > fifo.proceeds + 1 ? "LIFO" : "FIFO";
      const fullFifo = gainForSale(
        lotsOrdered(lots, "FIFO"),
        totalCuotas,
        valorCuota,
        ufSale,
      );
      const fullLifo = gainForSale(
        lotsOrdered(lots, "LIFO"),
        totalCuotas,
        valorCuota,
        ufSale,
      );

      setRun({
        status: "done",
        fondo,
        serie,
        openLots: lots.length,
        totalCuotas,
        valorCuota,
        lastDate: dateKey(saleDate),
        quoteSource,
        csvValorCuota: csvValorCuota ?? null,
        csvDate: csvDate ? dateKey(csvDate) : null,
        ufSale,
        nav: totalCuotas * valorCuota,
        maxGain,
        fifo,
        lifo,
        best,
        fullFifo: { proceeds: fullFifo.proceeds, gain: fullFifo.gain },
        fullLifo: { proceeds: fullLifo.proceeds, gain: fullLifo.gain },
      });
    } catch (err) {
      setRun({
        status: "error",
        message: err instanceof Error ? err.message : "Error al optimizar",
      });
    }
  }

  return (
    <div className="wrap">
      <header className="hero">
        <h1 className="brand">
          Migrador <span>107</span>
        </h1>
        <p className="lede">
          Mueve lo máximo posible del fondo Art. 108 al Art. 107 sin subir de
          tramo: define un tope de ganancia, compara FIFO y LIFO, y repite cada
          año.
        </p>
        <div className="meta">
          <span className="chip accent">108 → 107</span>
          <span className="chip">Mismo tramo</span>
          <span className="chip">Cuota · Fintual API</span>
          <span className="chip">
            FIFO / LIFO
            <InfoTip text={TIP_METHOD} />
          </span>
        </div>
      </header>

      <div className="layout">
        <aside className="panel controls">
          <div className="panel-title">
            <h2>Entrada</h2>
            <InfoTip text={TIP_CSV} />
          </div>

          <div className="section">
            <label className="file-drop">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              <span className="file-drop-title">
                {fileName ? "Cambiar CSV" : "Subir certificado CSV"}
              </span>
              <span className="file-drop-sub">
                {fileName ?? "certificado_de_transacciones.csv"}
              </span>
            </label>
            {rows && (
              <p className="hint">{rows.length.toLocaleString("es-CL")} filas cargadas</p>
            )}
            <p className="hint cert-help">
              ¿Cómo obtenerlo? En Fintual abre{" "}
              <a
                href="https://fintual.cl/app/certificates"
                target="_blank"
                rel="noreferrer"
              >
                Certificados
              </a>
              : elige <em>Certificado de transacciones en Fondos Mutuos</em> y
              descarga en <em>CSV</em> (lista de movimientos desde tu primer
              depósito).
            </p>
          </div>

          <div className="section">
            <HeadingWithTip tip={TIP_METHOD}>
              <h2 style={{ margin: 0 }}>Fondo</h2>
            </HeadingWithTip>
            <label className="field">
              <span>Nombre fondo</span>
              <select
                value={fondo}
                disabled={!options.length}
                onChange={(e) => {
                  const next = e.target.value;
                  setFondo(next);
                  const series = options.filter((o) => o.fondo === next);
                  if (series.length) setSerie(series[0].serie);
                }}
              >
                {options.length === 0 && (
                  <option value={fondo}>{fondo}</option>
                )}
                {[...new Set(options.map((o) => o.fondo))].map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Serie</span>
              <select
                value={serie}
                disabled={!options.length}
                onChange={(e) => setSerie(e.target.value)}
              >
                {options
                  .filter((o) => o.fondo === fondo)
                  .map((o) => (
                    <option key={`${o.fondo}-${o.serie}`} value={o.serie}>
                      {o.serie || "(sin serie)"}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Filtrar inversión (opcional)</span>
              <select
                value={investmentFilter}
                disabled={!investments.length}
                onChange={(e) => setInvestmentFilter(e.target.value)}
              >
                <option value="">Todas (como Fintual por fondo/serie)</option>
                {investments.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="section">
            <HeadingWithTip tip={TIP_QUOTE}>
              <h2 style={{ margin: 0 }}>Valor cuota</h2>
            </HeadingWithTip>
            <label className="check">
              <input
                type="checkbox"
                checked={useLiveQuote}
                onChange={(e) => setUseLiveQuote(e.target.checked)}
              />
              Usar cuota en vivo (API Fintual)
            </label>
            <label className="field">
              <span>Override manual (opcional)</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="ej. 4094,0982"
                value={manualValorCuota}
                onChange={(e) => setManualValorCuota(e.target.value)}
              />
            </label>
            <SliderRow
              id="max-gain"
              label="Tope de ganancia"
              tip={TIP_GAIN}
              value={maxGainM}
              min={0}
              max={20}
              step={0.1}
              display={formatClp(maxGainM * 1_000_000)}
              onChange={setMaxGainM}
            />
            <button
              type="button"
              className="primary-btn"
              disabled={!rows || run.status === "loading"}
              onClick={() => void optimize()}
            >
              {run.status === "loading" ? "Calculando…" : "Calcular migración"}
            </button>
          </div>
        </aside>

        <main>
          {run.status === "idle" && (
            <div className="panel">
              <div className="callout info">
                <strong>La idea</strong>
                <p>
                  Cada año rescatas del 108 solo la ganancia que cabe en tu
                  tramo (o bajo el Art. 57) y recompras en un fondo Art. 107.
                  Sube el certificado, elige el fondo 108 y el tope; verás
                  cuánto puedes migrar con FIFO vs LIFO sin pasarte.
                </p>
              </div>
            </div>
          )}

          {run.status === "loading" && (
            <div className="panel">
              <p className="lede" style={{ margin: 0 }}>
                {run.message}
              </p>
            </div>
          )}

          {run.status === "error" && (
            <div className="panel">
              <div className="callout warn">
                <strong>No se pudo calcular</strong>
                <p>{run.message}</p>
              </div>
            </div>
          )}

          {run.status === "done" && (
            <>
              <div className="stats">
                <div className="stat">
                  <span className="label">Lotes abiertos</span>
                  <span className="value">{run.openLots}</span>
                </div>
                <div className="stat">
                  <span className="label">Cuotas</span>
                  <span className="value">{formatCuotas(run.totalCuotas)}</span>
                </div>
                <div className="stat">
                  <span className="label">Patrimonio ~</span>
                  <span className="value">{formatClp(run.nav)}</span>
                </div>
                <div className="stat">
                  <span className="label">Valor cuota</span>
                  <span className="value">
                    {run.valorCuota.toLocaleString("es-CL", {
                      maximumFractionDigits: 4,
                    })}
                  </span>
                </div>
              </div>

              <div className="panel" style={{ marginBottom: "1rem" }}>
                <p className="hint" style={{ margin: 0 }}>
                  Cuota{" "}
                  {run.valorCuota.toLocaleString("es-CL", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}{" "}
                  ({run.lastDate}
                  {run.quoteSource === "fintual"
                    ? " · Fintual API"
                    : run.quoteSource === "manual"
                      ? " · manual"
                      : " · CSV"}
                  )
                  {run.csvValorCuota != null &&
                    run.quoteSource !== "csv" &&
                    run.csvDate && (
                      <>
                        {" "}
                        · CSV{" "}
                        {run.csvValorCuota.toLocaleString("es-CL", {
                          maximumFractionDigits: 4,
                        })}{" "}
                        ({run.csvDate})
                      </>
                    )}{" "}
                  · UF{" "}
                  {run.ufSale.toLocaleString("es-CL", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  · tope {formatClp(run.maxGain)} · {run.fondo} / {run.serie}
                </p>
              </div>

              <div className="method-grid">
                <MethodCard result={run.fifo} recommended={run.best === "FIFO"} />
                <MethodCard result={run.lifo} recommended={run.best === "LIFO"} />
              </div>

              <div className="panel" style={{ marginTop: "1.25rem" }}>
                <div className="callout info">
                  <strong>Recomendación: {run.best}</strong>
                  <p>
                    Para migrar lo máximo al 107 con ganancia ≤{" "}
                    {formatClp(run.maxGain)}, rescatar con {run.best}. Vende{" "}
                    {formatCuotas(
                      run.best === "FIFO" ? run.fifo.cuotas : run.lifo.cuotas,
                    )}{" "}
                    cuotas · recibes ~
                    {formatClp(
                      run.best === "FIFO" ? run.fifo.proceeds : run.lifo.proceeds,
                    )}{" "}
                    · ganancia ~
                    {formatClp(
                      run.best === "FIFO" ? run.fifo.gain : run.lifo.gain,
                    )}
                    . Luego puedes aportar eso a un fondo Art. 107.
                  </p>
                </div>
              </div>

              <div className="panel table-panel">
                <h2>Referencia: liquidar todo</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Método</th>
                      <th>Procede</th>
                      <th>Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>FIFO</td>
                      <td className="mono">{formatClp(run.fullFifo.proceeds)}</td>
                      <td className="mono">{formatClp(run.fullFifo.gain)}</td>
                    </tr>
                    <tr>
                      <td>LIFO</td>
                      <td className="mono">{formatClp(run.fullLifo.proceeds)}</td>
                      <td className="mono">{formatClp(run.fullLifo.gain)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>

      <footer>
        El CSV y el cálculo son locales. Valor cuota en vivo y UF salen de la{" "}
        <a href="https://fintual.cl/api-docs/index.html" target="_blank" rel="noreferrer">
          API pública de Fintual
        </a>{" "}
        y mindicador.cl. Esto no es asesoría tributaria; verifica el método de
        rescate en Fintual antes de operar.
      </footer>
    </div>
  );
}

function MethodCard({
  result,
  recommended,
}: {
  result: MethodResult;
  recommended: boolean;
}) {
  return (
    <div className={`panel method-card${recommended ? " recommended" : ""}`}>
      <div className="method-head">
        <h2 style={{ margin: 0 }}>{result.method}</h2>
        {recommended && <span className="chip accent">Mejor</span>}
      </div>
      <div className="stats" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
        <div className="stat">
          <span className="label">$ movidos</span>
          <span className="value">{formatClp(result.proceeds)}</span>
        </div>
        <div className="stat">
          <span className="label">Ganancia</span>
          <span className="value">{formatClp(result.gain)}</span>
        </div>
        <div className="stat">
          <span className="label">Cuotas</span>
          <span className="value">{formatCuotas(result.cuotas)}</span>
        </div>
        <div className="stat">
          <span className="label">Gan. / $</span>
          <span className="value">
            {formatGainShare(result.gain, result.proceeds)}
          </span>
        </div>
      </div>
      {result.takes.length > 0 && (
        <div className="takes">
          <h2>Lotes consumidos</h2>
          <ul>
            {result.takes.slice(0, 12).map((t, i) => (
              <li key={`${dateKey(t.lot.date)}-${i}`}>
                <span>{dateKey(t.lot.date)}</span>
                <span className="takes-inv">{t.lot.investment || "—"}</span>
                <span className="mono">{formatCuotas(t.cuotas)}</span>
              </li>
            ))}
          </ul>
          {result.takes.length > 12 && (
            <p className="hint">… +{result.takes.length - 12} lotes más</p>
          )}
        </div>
      )}
    </div>
  );
}
