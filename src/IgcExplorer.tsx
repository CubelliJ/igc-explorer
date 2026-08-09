import { useMemo, useState } from "react";
import { AreaChart } from "./components/AreaChart";
import { HeadingWithTip, InfoTip } from "./components/InfoTip";
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

const TIP_SALARY_CHANGE =
  "Puede ser mayor, menor o $0 (fin de relación laboral). El cambio aplica desde el mes elegido hasta fin de año.";

const TIP_FUND_REGIME =
  "Art. 108 LIR suma la ganancia al IGC progresivo. Art. 107 LIR (presencia bursátil / requisitos) aplica impuesto único del 10% hasta el 31/12/2026; desde el 01/01/2027 el mayor valor no constituye renta.";

const TIP_ART57 =
  "Exención Art. 57 LIR (30 UTM) para rescate de fondos mutuos de trabajadores dependientes / pequeños contribuyentes. Es un tope de todo o nada: si la ganancia anual no supera 30 UTM, queda exenta; si la supera, tributa la totalidad (no solo el exceso). Solo aplica bajo régimen Art. 108.";

const TIP_CHART_108 =
  "Claro = impuesto del sueldo/bono. Intenso = impuesto del fondo (Art. 108). Altura del rectángulo = tasa marginal del tramo.";

const TIP_CHART_107 =
  "El gráfico muestra el IGC laboral. El fondo Art. 107 se grava aparte: 10% único hasta 2026; 0% desde 2027 si cumple los requisitos.";

export function IgcExplorer() {
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
    // Art. 57: cliff exemption — under 30 UTM → $0 taxable; over → full gain taxable.
    const art57Applies =
      sellFund &&
      fundRegime === "108" &&
      applyExempt &&
      fundGainM > 0 &&
      fundGainM <= ART57_EXEMPT_M;
    const fundTaxableM =
      sellFund && fundRegime === "108"
        ? art57Applies
          ? 0
          : fundGainM
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
          <span className="chip">
            Renta imponible
            <InfoTip text="Los montos se tratan como renta imponible (base del IUSC / IGC), no como líquido a recibir." />
          </span>
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
                  tip={TIP_SALARY_CHANGE}
                  value={changeM}
                  min={0}
                  max={15}
                  step={0.1}
                  display={`${formatClp(changeM * 1e6)}/mes`}
                  onChange={setChangeM}
                />
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
            <h2>
              <HeadingWithTip tip={TIP_FUND_REGIME}>Fondo</HeadingWithTip>
            </h2>
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
                <div className="check-with-tip">
                  <label className="check">
                    <input
                      type="radio"
                      name="fundRegime"
                      checked={fundRegime === "108"}
                      onChange={() => setFundRegime("108")}
                    />
                    Art. 108 LIR
                  </label>
                  <InfoTip text="Suma la ganancia a la base del IGC progresivo (Art. 52)." />
                </div>
                <div className="check-with-tip">
                  <label className="check">
                    <input
                      type="radio"
                      name="fundRegime"
                      checked={fundRegime === "107"}
                      onChange={() => setFundRegime("107")}
                    />
                    Art. 107 LIR
                  </label>
                  <InfoTip text="Impuesto único 10% sobre la ganancia hasta el 31/12/2026. Desde el 01/01/2027 el mayor valor no constituye renta si cumple presencia bursátil / requisitos." />
                </div>
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
                    <div className="check-with-tip">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={applyExempt}
                          onChange={(e) => setApplyExempt(e.target.checked)}
                        />
                        Exención Art. 57
                      </label>
                      <InfoTip text={TIP_ART57} />
                    </div>
                    <p className="hint">
                      {result.fundTaxableM === 0 && fundGainM > 0
                        ? `Exento Art. 57 (≤ ${formatM(ART57_EXEMPT_M)})`
                        : `Imponible: ${formatM(result.fundTaxableM)}`}
                    </p>
                  </>
                ) : (
                  <p className="hint">
                    Impuesto único: {formatM(result.art107Tax)}
                    <InfoTip text="Tasa vigente 10% sobre la ganancia. Desde el 01/01/2027: $0 si el instrumento cumple Art. 107." />
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
            <div className="panel-title">
              <h2>Área bajo la curva</h2>
              <InfoTip
                text={fundRegime === "108" ? TIP_CHART_108 : TIP_CHART_107}
              />
            </div>
            <div className="chart-wrap">
              <AreaChart salaryM={result.salaryM} totalM={result.totalM} />
            </div>

            {sellFund && fundGainM > 0 ? (
              <div className="callout warn">
                <div className="callout-head">
                  <strong>Vender cuesta {formatM(result.extra)} extra</strong>
                  <InfoTip
                    text={
                      fundRegime === "108"
                        ? `Art. 108: de ${formatM(fundGainM)} brutos quedarían ${formatM(fundGainM - result.extra)} después del IGC adicional (${result.blended.toFixed(1)}% promedio). Siguiente peso al ${(result.nextPeso * 100).toFixed(1)}%.`
                        : `Art. 107: impuesto único ${formatM(result.art107Tax)} (10% vigente hasta 31/12/2026). Desde 01/01/2027 no constituye renta si cumple requisitos. Quedarían ${formatM(fundGainM - result.extra)}.`
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="callout info">
                <div className="callout-head">
                  <strong>
                    IGC laboral {formatM(result.taxNo)}
                  </strong>
                  <InfoTip
                    text={`Efectiva ${result.effNo.toFixed(1)}%. Siguiente peso al ${(result.nextPesoNo * 100).toFixed(1)}%.`}
                  />
                </div>
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
