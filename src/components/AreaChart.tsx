import { BRACKETS, BRACKET_COLORS, igc } from "../lib/igc";

type Props = {
  salaryM: number;
  totalM: number;
};

function effectiveRate(incomeM: number): number {
  if (incomeM <= 1e-9) return 0;
  return igc(incomeM) / incomeM;
}

export function AreaChart({ salaryM, totalM }: Props) {
  const width = 720;
  const height = 300;
  // Extra right pad so "+fondo / ef." labels can sit to the right of late markers.
  const pad = { top: 28, right: 56, bottom: 40, left: 48 };
  const xMax = Math.max(80, Math.ceil((totalM + 5) / 10) * 10);
  const yMax = 0.4;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const xScale = (x: number) => pad.left + (x / xMax) * plotW;
  const yScale = (y: number) => pad.top + plotH - (y / yMax) * plotH;

  const step: string[] = [];
  for (const b of BRACKETS) {
    if (b.lo >= xMax) break;
    const x0 = xScale(b.lo);
    const x1 = xScale(Math.min(b.hi, xMax));
    const y = yScale(Math.min(b.rate, yMax));
    if (!step.length) step.push(`M ${x0} ${y}`);
    else step.push(`L ${x0} ${y}`);
    step.push(`L ${x1} ${y}`);
  }

  // Dense samples of average/effective rate = IGC(x) / x
  const effPts: Array<{ x: number; y: number }> = [];
  const stepX = Math.max(0.25, xMax / 160);
  for (let x = stepX; x <= xMax + 1e-9; x += stepX) {
    effPts.push({ x, y: effectiveRate(x) });
  }
  // Exact points at bracket edges for clean corners in the derivative sense
  for (const b of BRACKETS) {
    if (b.lo > 0 && b.lo <= xMax) {
      effPts.push({ x: b.lo, y: effectiveRate(b.lo) });
    }
  }
  effPts.sort((a, b) => a.x - b.x);
  const effPath = effPts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x)} ${yScale(p.y)}`)
    .join(" ");

  const yTicks = [0, 0.04, 0.08, 0.135, 0.23, 0.304, 0.35];
  const xTicks: number[] = [];
  for (let t = 0; t <= xMax; t += xMax > 120 ? 20 : 10) xTicks.push(t);

  const showFund = totalM > salaryM + 0.05;
  const effSalary = salaryM > 0 ? effectiveRate(salaryM) : 0;
  const effTotal = totalM > 0 ? effectiveRate(totalM) : 0;

  const xSal = xScale(salaryM);
  const xTot = xScale(totalM);
  // With both markers: laboral always left of its line, +fondo always right —
  // never flip +fondo left (that collided with laboral near the right edge).
  const salAnchor = showFund ? "end" : "start";
  const salX = showFund
    ? Math.max(pad.left + 2, xSal - 5)
    : Math.min(xSal + 5, width - pad.right - 4);
  const totAnchor = "start" as const;
  const totX = Math.min(xTot + 5, width - pad.right - 4);

  const markDot = (incomeM: number, color: string) => {
    if (incomeM <= 0) return null;
    return (
      <circle
        key={`dot-${color}-${incomeM}`}
        cx={xScale(incomeM)}
        cy={yScale(effectiveRate(incomeM))}
        r={3.5}
        fill={color}
        stroke="#fff"
        strokeWidth={1.25}
      />
    );
  };

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Tasa marginal y tasa efectiva del IGC"
    >
      {yTicks.map((t) => (
        <g key={`y-${t}`}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={yScale(t)}
            y2={yScale(t)}
            stroke="rgba(14,26,36,0.1)"
            strokeDasharray="3 4"
          />
          <text
            x={pad.left - 8}
            y={yScale(t) + 3}
            textAnchor="end"
            fill="#6b7c88"
            fontSize={10}
            fontFamily="IBM Plex Mono, monospace"
          >
            {(t * 100).toFixed(t < 0.1 ? 0 : 1)}%
          </text>
        </g>
      ))}

      {xTicks.map((t) => (
        <text
          key={`x-${t}`}
          x={xScale(t)}
          y={height - 12}
          textAnchor="middle"
          fill="#6b7c88"
          fontSize={10}
          fontFamily="IBM Plex Mono, monospace"
        >
          ${t}M
        </text>
      ))}

      {BRACKETS.map((b, i) => {
        const lo = b.lo;
        const hi = Math.min(b.hi, salaryM);
        if (!(hi > lo && salaryM > b.lo && b.rate > 0)) return null;
        return (
          <rect
            key={`sal-${i}`}
            x={xScale(lo)}
            y={yScale(b.rate)}
            width={xScale(hi) - xScale(lo)}
            height={yScale(0) - yScale(b.rate)}
            fill={BRACKET_COLORS[i]}
            opacity={0.35}
          />
        );
      })}

      {BRACKETS.map((b, i) => {
        const lo = Math.max(b.lo, salaryM);
        const hi = Math.min(b.hi, totalM);
        if (!(hi > lo)) return null;
        return (
          <rect
            key={`fund-${i}`}
            x={xScale(lo)}
            y={yScale(b.rate)}
            width={xScale(hi) - xScale(lo)}
            height={yScale(0) - yScale(b.rate)}
            fill={BRACKET_COLORS[i]}
            opacity={0.9}
          />
        );
      })}

      <path d={step.join(" ")} fill="none" stroke="#0e1a24" strokeWidth={1.5} />
      <path
        d={effPath}
        fill="none"
        stroke="#b45309"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <line
        x1={xScale(salaryM)}
        x2={xScale(salaryM)}
        y1={pad.top}
        y2={pad.top + plotH}
        stroke="#3a4a56"
        strokeDasharray="5 4"
      />
      <line
        x1={xScale(totalM)}
        x2={xScale(totalM)}
        y1={pad.top}
        y2={pad.top + plotH}
        stroke="#0f6e6a"
        strokeWidth={1.5}
      />
      {salaryM > 0 ? (
        <g>
          <text
            x={salX}
            y={pad.top + 12}
            textAnchor={salAnchor}
            fill="#3a4a56"
            fontSize={10}
            fontFamily="Outfit, sans-serif"
          >
            laboral
          </text>
          <text
            x={salX}
            y={pad.top + 24}
            textAnchor={salAnchor}
            fill="#b45309"
            fontSize={10}
            fontFamily="IBM Plex Mono, monospace"
          >
            ef. {(effSalary * 100).toFixed(1)}%
          </text>
        </g>
      ) : null}
      {showFund ? (
        <g>
          <text
            x={totX}
            y={pad.top + 12}
            textAnchor={totAnchor}
            fill="#0f6e6a"
            fontSize={10}
            fontFamily="Outfit, sans-serif"
          >
            +fondo
          </text>
          <text
            x={totX}
            y={pad.top + 24}
            textAnchor={totAnchor}
            fill="#9a3412"
            fontSize={10}
            fontFamily="IBM Plex Mono, monospace"
          >
            ef. {(effTotal * 100).toFixed(1)}%
          </text>
        </g>
      ) : null}

      {markDot(salaryM, "#b45309")}
      {showFund ? markDot(totalM, "#9a3412") : null}
    </svg>
  );
}
