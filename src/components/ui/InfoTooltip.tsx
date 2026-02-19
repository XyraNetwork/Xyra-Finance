'use client';

type InfoTooltipProps = {
  tip: string;
  className?: string;
};

export function InfoTooltip({ tip, className = '' }: InfoTooltipProps) {
  return (
    <span
      className={`tooltip tooltip-bottom tooltip-info inline-flex items-center justify-center ml-1 cursor-help ${className}`}
      data-tip={tip}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-4 h-4 text-base-content/60 hover:text-base-content/80 transition-colors"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
        />
      </svg>
    </span>
  );
}
