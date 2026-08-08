import { useMemo, useState } from "react";
import { AreaChart } from "./components/AreaChart";
import { SliderRow } from "./components/SliderRow";
import {
  annualSalary,
  ART57_EXEMPT_M,
  bracketLabel,
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
  const [enableRaise, setEnableRaise] = useState(false);
  const [raiseM, setRaiseM] = useState(0);
  const [raiseFrom, setRaiseFrom] = useState(1);
  const [bonusM, setBonusM] = useState(0);
  const [bonusMonth, setBonusMonth] = useState(1);
  const [sellFund, setSellFund] = useState(false);
  const [fundGainM, setFundGainM] = useState(0);
  const [applyExempt, setApplyExempt] = useState(true);

  const safeRaiseM = Math.max(raiseM, monthlyM);

  const result = useMemo(() => {
    const raiseStart = enableRaise ? raiseFrom : 13;
    const salaryM = annualSalary(
      monthlyM,
      safeRaiseM,
      raiseStart,
      bonusM,
      bonusMonth,
    );
    const exempt = applyExempt ? ART57_EXEMPT_M : 0;
    const fundTaxableM = sellFund ? Math.max(0, fundGainM - exempt) : 0;
    const totalM = salaryM + fundTaxableM;
    const taxNo = igc(salaryM);
    const taxYes = igc(totalM);
    const extra = taxYes - taxNo;
    const nextPeso = marginalRate(totalM);
    const nextPesoNo = marginalRate(salaryM);
    const blended =
      fundGainM > 0 && sellFund ? (extra / fundGainM) * 100 : 0;
    const effYes = totalM > 0 ? (taxYes / totalM) * 100 : 0;
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
    };
  }, [
    monthlyM,
    enableRaise,
    safeRaiseM,
    raiseFrom,
    bonusM,
    bonusMonth,
    sellFund,
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
          Simula tu Impuesto Global Complementario ajustando sueldo, bono, alza
          y ganancia de fondos. El impuesto es el área bajo la escalera de
          tasas.
        </p>
        <div className="meta">
          <span className="chip accent">Art. 52 LIR · AT 2026</span>
          <span className="chip">UTA $834.504</span>
          <span className="chip">Montos como renta líquida imponible</span>
        </div>
      </header>

      <div className="layout">
        <aside className="panel controls">
          <div className="section">
            <h2>Ingresos</h2>
            <SliderRow
              id="monthly"
              label="Sueldo mensual actual"
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
                checked={enableRaise}
                onChange={(e) => setEnableRaise(e.target.checked)}
              />
              Aplicar alza de sueldo
            </label>

            {enableRaise ? (
              <>
                <SliderRow
                  id="raise"
                  label="Sueldo tras alza"
                  value={safeRaiseM}
                  min={monthlyM}
                  max={15}
                  step={0.1}
                  display={`${formatClp(safeRaiseM * 1e6)}/mes`}
                  onChange={setRaiseM}
                />
                <SliderRow
                  id="raiseFrom"
                  label="Mes de alza"
                  value={raiseFrom}
                  min={1}
                  max={12}
                  step={1}
                  display={MONTHS[raiseFrom - 1]}
                  onChange={setRaiseFrom}
                />
              </>
            ) : null}
          </div>

          <div className="section">
            <h2>Bono</h2>
            <SliderRow
              id="bonus"
              label="Monto del bono"
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
          </div>

          <div className="section">
            <h2>Fondo</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={sellFund}
                onChange={(e) => setSellFund(e.target.checked)}
              />
              Vender el fondo este año
            </label>

            {sellFund ? (
              <>
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
                <label className="check">
                  <input
                    type="checkbox"
                    checked={applyExempt}
                    onChange={(e) => setApplyExempt(e.target.checked)}
                  />
                  Exención Art. 57 (~$2.09M)
                </label>
                <p className="hint">
                  Imponible fondo: {formatM(result.fundTaxableM)}
                </p>
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
              Marginal sin fondo {(result.nextPesoNo * 100).toFixed(1)}%
            </span>
            {sellFund ? (
              <span className="chip warn">
                Marginal con fondo {(result.nextPeso * 100).toFixed(1)}%
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
              Claro = impuesto del sueldo/bono · Intenso = impuesto del fondo ·
              Altura = tasa marginal
            </p>

            {sellFund && fundGainM > 0 ? (
              <div className="callout warn">
                <strong>Vender cuesta {formatM(result.extra)} extra</strong>
                <p>
                  De {formatM(fundGainM)} brutos quedarían{" "}
                  {formatM(fundGainM - result.extra)} después del IGC adicional
                  ({result.blended.toFixed(1)}% promedio sobre el fondo). El
                  siguiente peso tributa al{" "}
                  {(result.nextPeso * 100).toFixed(1)}%.
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
        mensuales se tratan como renta líquida imponible.
      </footer>
    </div>
  );
}
