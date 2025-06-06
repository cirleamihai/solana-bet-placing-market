import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Point { t: number; yesProb: number; }
export default function MarketPriceChart({ points }: { points: Point[] }) {
    // Convert ms-epoch → HH:MM for the tooltip / axis
    const fmt = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Compute noProb inline and pass both to the chart
    const enriched = points.map((p) => ({
        ...p,
        noProb: 100 - p.yesProb,
    }));

    return (
        <div className="w-full h-110 bg-[#2f4150] rounded-xl p-4 shadow-md">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={enriched}>
                    <XAxis
                        dataKey="t"
                        tickFormatter={fmt}
                        stroke="#cbd5e1"
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        stroke="#cbd5e1"
                        tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                        labelFormatter={(label) => fmt(label as number)}
                        formatter={(value, name) => {
                            const label = name === "yesProb" ? "Yes" : "No";
                            return [`${value}% ${label}`];
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="yesProb"
                        stroke="#22c55e" // green-500
                        strokeWidth={1}
                        dot={false}
                        name="yesProb"
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="noProb"
                        stroke="#ef4444" // red-500
                        strokeWidth={1}
                        dot={false}
                        name="noProb"
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
