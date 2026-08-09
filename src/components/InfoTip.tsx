import type { ReactNode } from "react";

type Props = {
  text: string;
  label?: string;
};

/** Compact (?) control; shows explanation on hover / focus / tap. */
export function InfoTip({ text, label = "Más información" }: Props) {
  return (
    <span className="info-tip">
      <button type="button" className="info-tip-btn" aria-label={label}>
        ?
      </button>
      <span className="info-tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}

type HeadingProps = {
  children: ReactNode;
  tip?: string;
};

export function HeadingWithTip({ children, tip }: HeadingProps) {
  return (
    <span className="heading-with-tip">
      {children}
      {tip ? <InfoTip text={tip} /> : null}
    </span>
  );
}
