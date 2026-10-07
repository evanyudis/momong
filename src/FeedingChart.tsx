import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function FeedingChart({ days, metric }: {
  days: { at: number; day: string; date: string; feeds: number; pump: number; diapers: number }[];
  metric: { key: "feeds" | "pump" | "diapers"; label: string; unit: string; color: string };
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={days} aria-label={`Grafik ${metric.label.toLowerCase()} tujuh hari dalam ${metric.unit}`} accessibilityLayer margin={{ top: 12, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid vertical={false} stroke="var(--border-subtle)" strokeDasharray="3 3" />
        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--ink-muted)", fontSize: 12 }} interval={0} />
        <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "var(--ink-muted)", fontSize: 12 }} />
        <Tooltip isAnimationActive={false} cursor={{ fill: "var(--surface-sunk)" }} labelFormatter={(_, payload) => payload[0]?.payload.date ?? ""} contentStyle={{ background: "var(--surface)", color: "var(--ink)", border: "none", borderRadius: 12, boxShadow: "var(--elevation-raised)" }} />
        <Bar dataKey={metric.key} name={metric.label} unit={` ${metric.unit}`} fill={metric.color} radius={[6, 6, 0, 0]} maxBarSize={32} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
