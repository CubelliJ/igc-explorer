import { InfoTip } from "./InfoTip";

type Props = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  tip?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export function SliderRow({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  tip,
  disabled,
  onChange,
}: Props) {
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={id} className="slider-label">
          {label}
          {tip ? <InfoTip text={tip} /> : null}
        </label>
        <output htmlFor={id}>{display}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
