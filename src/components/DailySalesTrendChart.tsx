'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type DailySalesTrendPoint = {
  label: string
  売上: number
  会計数: number
}

export default function DailySalesTrendChart({
  data,
}: {
  data: DailySalesTrendPoint[]
}) {
  return (
    <div className="h-[320px] rounded-2xl border border-[var(--line-soft)] bg-[#fcfdff] p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e9eef6" />
          <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} />
          <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 12 }} />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === '売上' ? [`${value.toLocaleString()} 円`, name] : [`${value.toLocaleString()} 件`, name]
            }
          />
          <Legend />
          <Bar yAxisId="left" dataKey="売上" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="会計数" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
