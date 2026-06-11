"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Mover {
  pk: string;
  sk: string;
  percentChange: number;
  close: number;
}

interface MetricsRowProps {
  movers: Mover[];
}

export function MetricsRow({ movers }: MetricsRowProps) {
  const totalDays = movers.length;
  if (!totalDays) return null;

  const avgChange = movers.reduce((acc, curr) => acc + curr.percentChange, 0) / totalDays;
  const topMover = movers[0];

  const counts = movers.reduce((acc, m) => {
    acc[m.pk] = (acc[m.pk] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const [dominantSymbol, dominantCount] = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0] || ["-", 0];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card size="sm">
        <CardHeader>
          <CardDescription>Most Frequent Top Mover</CardDescription>
          <CardTitle className="text-lg">
            {dominantSymbol} <span className="text-xs font-normal text-muted-foreground">({dominantCount} days)</span>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardDescription>Average Mover Change</CardDescription>
          <CardTitle className="text-lg">
            <span className={avgChange >= 0 ? "text-emerald-600" : "text-red-600"}>
              {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
            </span>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardDescription>Today&apos;s Top Mover</CardDescription>
          <CardTitle className="text-lg">
            {topMover.pk}{" "}
            <span className={`text-xs font-normal ${topMover.percentChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {topMover.percentChange >= 0 ? "+" : ""}{topMover.percentChange.toFixed(2)}%
            </span>
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
