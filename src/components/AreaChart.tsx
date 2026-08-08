import { BRACKETS, BRACKET_COLORS } from "../lib/igc";

type Props = {
  salaryM: number;
  totalM: number;
};

export function AreaChart({ salaryM, totalM }: Props) {
  const width = 720;
  const height = 300;
  const pad = { top: 28, right: 20, bottom: 40, left: 48 };
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

  const yTicks = [0, 0.04, 0.08, 0.135, 0.23, 0.304, 0.35];
  const xTicks: number[] = [];
  for (let t = 0; t <= xMax; t += xMax > 120 ? 20 : 10) xTicks.push(t);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Área bajo la curva del IGC"
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
      <text
        x={xScale(salaryM) + 4}
        y={pad.top + 12}
        fill="#3a4a56"
        fontSize={10}
        fontFamily="Outfit, sans-serif"
      >
        laboral
      </text>
      <text
        x={Math.min(xScale(totalM) + 4, width - pad.right - 40)}
        y={pad.top + 26}
        fill="#0f6e6a"
        fontSize={10}
        fontFamily="Outfit, sans-serif"
      >
        +fondo
      </text>
    </svg>
  );
}
