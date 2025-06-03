interface ProbabilityRingProps {
    /** 0-100 integer – will be clamped internally */
    value: number;
    /** Diameter in px (default 40) */
    size?: number;
    /** Ring thickness in px (default 4) */
    stroke?: number;
}

// @ts-ignore
function ProbabilityRing({
                             value,
                             size = 40,
                             stroke = 4,
                         }: ProbabilityRingProps) {
    const pct = Math.max(0, Math.min(100, value));
    const radius = (36 - stroke) / 2;     // fit nicely inside viewBox 0‒36
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - pct / 100);

    // orange for “No”, green for “Yes”; tweak to taste
    const accent = pct >= 50 ? "#4ade80" : "#f97316";

    return (
        <svg
            viewBox="0 0 36 36"
            width={size}
            height={size}
            className="select-none"
        >
            {/* track */}
            <circle
                cx="18"
                cy="18"
                r={radius}
                stroke="#475569"
                strokeWidth={stroke}
                fill="none"
            />
            {/* progress */}
            <circle
                cx="18"
                cy="18"
                r={radius}
                stroke={accent}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                fill="none"
                transform="rotate(-90 18 18)" // 12 o’clock start
            />
            {/* label */}
            <text
                x="18"
                y="20.5"
                textAnchor="middle"
                className="fill-slate-200 text-[6px] font-semibold"
            >
                {pct}%
            </text>
        </svg>
    );
};

export default ProbabilityRing;
