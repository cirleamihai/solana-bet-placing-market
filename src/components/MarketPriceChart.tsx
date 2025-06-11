import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from "recharts";

export interface ChartPoint {
    t: number;
    yesProb: string;
    noProb: string;
}

export default function MarketPriceChart({ points }: { points: ChartPoint[] }) {
    const fmt = (ts: number) =>
        new Date(ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

    const getXTicks = (data: ChartPoint[]) => {
        const count = Math.min(6, data.length);
        const step = Math.max(1, Math.floor(data.length / count));
        return data.filter((_, i) => i % step === 0).map((d) => d.t);
    };

    const reversedPoints = [...points].reverse();

    return (
        <div className="w-full h-110 bg-[#2f4150] rounded-xl p-4 shadow-md mb-5">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reversedPoints}>
                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#475569" />

                    <XAxis
                        dataKey="t"
                        tickFormatter={fmt}
                        ticks={getXTicks(reversedPoints)}
                        stroke="#cbd5e1"
                        tick={{ fontSize: 12 }}
                    />

                    <YAxis
                        domain={[0, 1]}
                        tickFormatter={(v) => `$${v.toFixed(2)}`}
                        stroke="#cbd5e1"
                        tick={{ fontSize: 12 }}
                    />

                    <Tooltip
                        labelFormatter={(label) =>
                            new Date(label as number).toLocaleString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                            })
                        }
                        formatter={(value, name) => {
                            const label = name === "yesProb" ? "Yes" : "No";
                            return [`$${Number(value).toFixed(2)}`, label];  // Recharts uses [value, name]
                        }}
                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#64748b" }}
                        labelStyle={{ color: "#94a3b8" }}
                        itemStyle={{ fontWeight: 500 }} // Don't set color here — line color auto-applies
                    />

                    <Line
                        type="monotone"
                        dataKey="yesProb"
                        stroke="#22c55e"
                        strokeWidth={1.5}
                        dot={false}
                        name="yesProb"
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="noProb"
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        dot={false}
                        name="noProb"
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
