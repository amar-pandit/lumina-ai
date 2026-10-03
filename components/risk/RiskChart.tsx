"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RiskChartProps {
  data: Array<{ week: string; value: number }>;
}

export function RiskChart({ data }: RiskChartProps) {
  return (
    <div className="h-72 w-full rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#27272A" strokeDasharray="3 3" />
          <XAxis dataKey="week" stroke="#A1A1AA" tickLine={false} axisLine={false} />
          <YAxis stroke="#A1A1AA" tickLine={false} axisLine={false} domain={[55, 85]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181B",
              border: "1px solid #27272A",
              borderRadius: "12px",
              color: "#fff",
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#4F46E5"
            strokeWidth={3}
            dot={{ fill: "#A78BFA", r: 4 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
