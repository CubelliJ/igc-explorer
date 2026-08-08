import { useMemo, useState } from "react";
import { AreaChart } from "./components/AreaChart";
import { SliderRow } from "./components/SliderRow";
import {
  annualSalary,
  ART57_EXEMPT_M,
  bracketLabel,
  defaultRaiseFromNow,
  decompose,
  formatClp,
  formatM,
  igc,
  marginalRate,
  MONTHS,
} from "./lib/igc";
import "./App.css";

export default function App() {
  const [monthlyM, setMonthlyM] = useState(0);
  const [enableChange, setEnableChange] = useState(false);
  const [changeM, setChangeM] = useState(0);
  // Default: +2 months; in Nov/Dic → July (mid-year, retroactive this AT).
  const [changeFrom, setChangeFrom] = useState(defaultRaiseFromNow);
  const [enableBonus, setEnableBonus] = useState(false);
  const [bonusM, setBonusM] = useState(0);
  const [bonusMonth, setBonusMonth] = useState(1);
  const [sellFund, setSellFund] = useState(false);
  /** Art. 108 → IGC progresivo; Art. 107 → impuesto único 10% (0% desde 2027). */
  const [fundRegime, setFundRegime] = useState<"108" | "107">("108");
  const [fundGainM, setFundGainM] = useState(0);
  const [applyExempt, setApplyExempt] = useState(true);

  const effectiveBonusM = enableBonus ? bonusM : 0;

  const result = useMemo(() => {
    const changeStart = enableChange ? changeFrom : 13;
    const salaryM = annualSalary(
      monthlyM,
      changeM,
      changeStart,
      effectiveBonusM,
      bonusMonth,
    );
    const exempt =
      sellFund && fundRegime === "108" && applyExempt ? ART57_EXEMPT_M : 0;
    const fundTaxableM =
      sellFund && fundRegime === "108"
        ? Math.max(0, fundGainM - exempt)
        : 0;
    const totalM = salaryM + fundTaxableM;
    const taxNo = igc(salaryM);
    const igcWithFund = igc(totalM);

    // Art. 107: impuesto único 10% sobre la ganancia hasta el 31/12/2026;
    // desde el 01/01/2027 el mayor valor no constituye renta (0%).
    const art107Rate = 0.1;
    const art107Tax =
      sellFund && fundRegime === "107" ? fundGainM * art107Rate : 0;

    const taxYes =
      fundRegime === "107" ? taxNo + art107Tax : igcWithFund;
    const extra = taxYes - taxNo;
    const nextPeso =
      fundRegime === "107" && sellFund
        ? art107Rate
        : marginalRate(totalM);
    const nextPesoNo = marginalRate(salaryM);
    const blended =
      fundGainM > 0 && sellFund ? (extra / fundGainM) * 100 : 0;
    const globalBase = salaryM + (sellFund ? fundGainM : 0);
    const effYes = globalBase > 0 ? (taxYes / globalBase) * 100 : 0;
    const effNo = salaryM > 0 ? (taxNo / salaryM) * 100 : 0;
    const rows = decompose(salaryM, fundTaxableM);

    return {
      salaryM,
      fundTaxableM,
      totalM,
      taxNo,
      taxYes,
      extra,
      nextPeso,
      nextPesoNo,
      blended,
      effYes,
      effNo,
      rows,
      art107Tax,
      fundRegime,
    };
  }, [
    monthlyM,
    enableChange,
    changeM,
    changeFrom,
    effectiveBonusM,
    bonusMonth,
    sellFund,
    fundRegime,
    fundGainM,
    applyExempt,
  ]);

  return (
    <div className="wrap">
      <header className="hero">
        <h1 className="brand">
          IGC <span>Explorer</span>
        </h1>
        <p className="lede">
          Simula tu Impuesto Global Complementario ajustando sueldo, bono,
          cambios de renta y ganancia de fondos. El impuesto es el área bajo la
          escalera de tasas.
        </p>
        <div className="meta">
          <span className="chip accent">Art. 52 LIR · AT 2026</span>
          <span className="chip">UTA $834.504</span>
          <span className="chip">Montos como renta imponible</span>
        </div>
      </header>

      <div className="layout">
        <aside className="panel controls">
          <div className="section">
            <h2>Ingresos</h2>
            <SliderRow
              id="monthly"
              label="Sueldo imponible mensual actual"
              value={monthlyM}
              min={0}
              max={12}
              step={0.1}
              display={`${formatClp(monthlyM * 1e6)}/mes`}
              onChange={setMonthlyM}
            />

            <label className="check">
              <input
                type="checkbox"
                checked={enableChange}
                onChange={(e) => {
                  const on = e.target.checked;
                  setEnableChange(on);
                  // Start from current sueldo; user can slide to $0 if needed
                  if (on && changeM === 0 && monthlyM > 0) setChangeM(monthlyM);
                }}
              />
              Aplicar cambio de sueldo
            </label>

            {enableChange ? (
              <>
                <SliderRow
                  id="change"
                  label="Sueldo imponible tras el cambio"
                  value={changeM}
                  min={0}
                  max={15}
                  step={0.1}
                  display={`${formatClp(changeM * 1e6)}/mes`}
                  onChange={setChangeM}
                />
                <p className="hint">
                  Puede ser mayor, menor o $0 (fin de relación laboral).
                </p>
                <SliderRow
                  id="changeFrom"
                  label="Mes del cambio"
                  value={changeFrom}
                  min={1}
                  max={12}
                  step={1}
                  display={MONTHS[changeFrom - 1]}
                  onChange={setChangeFrom}
                />
              </>
            ) : null}
          </div>

          <div className="section">
            <h2>Bono anual</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={enableBonus}
                onChange={(e) => setEnableBonus(e.target.checked)}
              />
              Incluir bono anual
            </label>

            {enableBonus ? (
              <>
                <SliderRow
                  id="bonus"
                  label="Monto bruto del bono"
                  value={bonusM}
                  min={0}
                  max={30}
                  step={0.5}
                  display={formatClp(bonusM * 1e6)}
                  onChange={setBonusM}
                />
                <SliderRow
                  id="bonusMonth"
                  label="Mes del bono"
                  value={bonusMonth}
                  min={1}
                  max={12}
                  step={1}
                  display={MONTHS[bonusMonth - 1]}
                  onChange={setBonusMonth}
                />
              </>
            ) : null}
          </div>

          <div className="section">
            <h2>Fondo</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={sellFund}
                onChange={(e) => setSellFund(e.target.checked)}
              />
              Vender / rescatar el fondo este año
            </label>

            {sellFund ? (
              <>
                <p className="hint">
                  Elige el régimen del instrumento. Art. 108 LIR suma la ganancia
                  al IGC. Art. 107 LIR (presencia bursátil / requisitos) aplica
                  impuesto único del 10% hasta el 31/12/2026; desde el 01/01/2027
                  el mayor valor no constituye renta.
                </p>
                <label className="check">
                  <input
                    type="radio"
                    name="fundRegime"
                    checked={fundRegime === "108"}
                    onChange={() => setFundRegime("108")}
                  />
                  Art. 108 LIR (IGC progresivo)
                </label>
                <label className="check">
                  <input
                    type="radio"
                    name="fundRegime"
                    checked={fundRegime === "107"}
                    onChange={() => setFundRegime("107")}
                  />
                  Art. 107 LIR (10% único · 0% desde 2027)
                </label>
                <SliderRow
                  id="fund"
                  label="Ganancia del fondo"
                  value={fundGainM}
                  min={0}
                  max={80}
                  step={0.5}
                  display={formatClp(fundGainM * 1e6)}
                  onChange={setFundGainM}
                />
                {fundRegime === "108" ? (
                  <>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={applyExempt}
                        onChange={(e) => setApplyExempt(e.target.checked)}
                      />
                      Exención Art. 57 (~$2.09M)
                    </label>
                    <p className="hint">
                      Imponible fondo (Art. 108): {formatM(result.fundTaxableM)}
                    </p>
                  </>
                ) : (
                  <p className="hint">
                    Impuesto único Art. 107 (tasa vigente 10%):{" "}
                    {formatM(result.art107Tax)}. Desde el 01/01/2027: $0 si
                    cumple los requisitos del artículo.
                  </p>
                )}
              </>
            ) : null}
          </div>
        </aside>

        <main>
          <div className="stats">
            <div className="stat">
              <span className="label">Renta laboral</span>
              <span className="value">{formatM(result.salaryM)}</span>
            </div>
            <div className="stat">
              <span className="label">IGC sin fondo</span>
              <span className="value">{formatM(result.taxNo)}</span>
            </div>
            <div className="stat danger">
              <span className="label">IGC total</span>
              <span className="value">{formatM(result.taxYes)}</span>
            </div>
            <div className="stat warn">
              <span className="label">Extra por fondo</span>
              <span className="value">
                {sellFund ? formatM(result.extra) : "$0"}
              </span>
            </div>
          </div>

          <div className="pills">
            <span className="chip">
              Tramo laboral {bracketLabel(result.salaryM)}
            </span>
            <span className="chip accent">
              Marginal laboral {(result.nextPesoNo * 100).toFixed(1)}%
            </span>
            {sellFund ? (
              <span className="chip warn">
                {fundRegime === "107"
                  ? `Art. 107 · ${(result.nextPeso * 100).toFixed(0)}% único`
                  : `Marginal Art. 108 · ${(result.nextPeso * 100).toFixed(1)}%`}
              </span>
            ) : null}
            {sellFund && fundGainM > 0 ? (
              <span className="chip">
                Tasa media s/ fondo {result.blended.toFixed(1)}%
              </span>
            ) : null}
            <span className="chip">
              Efectiva {result.effYes.toFixed(1)}%
            </span>
          </div>

          <div className="panel">
            <h2>Área bajo la curva</h2>
            <div className="chart-wrap">
              <AreaChart salaryM={result.salaryM} totalM={result.totalM} />
            </div>
            <p className="chart-caption">
              {fundRegime === "108"
                ? "Claro = impuesto del sueldo/bono · Intenso = impuesto del fondo (Art. 108) · Altura = tasa marginal"
                : "El gráfico muestra el IGC laboral. El fondo Art. 107 se grava aparte (10% único hasta 2026; 0% desde 2027)."}
            </p>

            {sellFund && fundGainM > 0 ? (
              <div className="callout warn">
                <strong>Vender cuesta {formatM(result.extra)} extra</strong>
                <p>
                  {fundRegime === "108" ? (
                    <>
                      Régimen Art. 108 LIR: de {formatM(fundGainM)} brutos
                      quedarían {formatM(fundGainM - result.extra)} después del
                      IGC adicional ({result.blended.toFixed(1)}% promedio sobre
                      el fondo). El siguiente peso tributa al{" "}
                      {(result.nextPeso * 100).toFixed(1)}%.
                    </>
                  ) : (
                    <>
                      Régimen Art. 107 LIR: impuesto único de{" "}
                      {formatM(result.art107Tax)} (10% sobre la ganancia), vigente
                      hasta el 31/12/2026. Desde el 01/01/2027 el mayor valor no
                      constituye renta si el instrumento cumple los requisitos.
                      Quedarían {formatM(fundGainM - result.extra)} de la
                      ganancia.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div className="callout info">
                <strong>Sin venta de fondo</strong>
                <p>
                  IGC laboral {formatM(result.taxNo)} · efectiva{" "}
                  {result.effNo.toFixed(1)}% · siguiente peso al{" "}
                  {(result.nextPesoNo * 100).toFixed(1)}%.
                </p>
              </div>
            )}
          </div>

          <div className="panel table-panel">
            <h2>Desglose por tramo</h2>
            <table>
              <thead>
                <tr>
                  <th>Tramo</th>
                  <th>Tasa</th>
                  <th>Área laboral</th>
                  <th>Área fondo</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.label}>
                    <td>
                      <span
                        className="swatch"
                        style={{ background: r.color }}
                      />
                      {r.label}
                    </td>
                    <td className="mono">{(r.rate * 100).toFixed(1)}%</td>
                    <td className="mono">{formatM(r.salaryTaxM)}</td>
                    <td className="mono">{formatM(r.fundTaxM)}</td>
                    <td className="mono">
                      {formatM(r.salaryTaxM + r.fundTaxM)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <footer>
        Estimación educativa basada en la tabla Art. 52 LIR (AT 2026). No
        reemplaza asesoría tributaria ni la propuesta del SII. Los montos
        mensuales se tratan como renta imponible.
      </footer>
    </div>
  );
}
