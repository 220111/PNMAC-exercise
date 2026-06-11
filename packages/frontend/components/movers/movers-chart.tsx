"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList } from "recharts";

interface Mover {
  pk: string;
  sk: string;
  percentChange: number;
  close: number;
}

interface WinnersChartProps {
  movers: Mover[];
  formatDate: (dateStr: string) => string;
}

const chartConfig = {
  percentChange: {
    label: "Daily Change (%)",
  },
} satisfies ChartConfig;

export function MoversChart({ movers, formatDate }: WinnersChartProps) {
  if (movers.length === 0) return null;

  const chartData = [...movers]
    .sort((a, b) => b.sk.localeCompare(a.sk))
    .map((item) => ({
      ...item,
      formattedDate: formatDate(item.sk),
      rowLabel: `${formatDate(item.sk)}`,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Movers Performance</CardTitle>
        <CardDescription>
          Comparing daily top mover gains/losses
        </CardDescription>
      </CardHeader>
      <CardContent className="h-80 sm:h-96 pr-2 w-full overflow-hidden">
        <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val}%`}
              className="text-[0.7rem]"
            />
            <YAxis
              dataKey="rowLabel"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              className="text-[0.65rem] sm:text-[0.7rem] font-medium"
              width={85}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name, item) => (
                    <div className="p-1 space-y-1 text-xs">
                      <div className="font-semibold">{item.payload.pk}</div>
                      <div className="text-muted-foreground flex justify-between gap-4">
                        <span>Date</span>
                        <span className="text-foreground">{item.payload.formattedDate}</span>
                      </div>
                      <div className="text-muted-foreground flex justify-between gap-4">
                        <span>Close Price</span>
                        <span className="text-foreground">${item.payload.close.toFixed(2)}</span>
                      </div>
                      <div className="text-muted-foreground flex justify-between gap-4">
                        <span>Change</span>
                        <span className={item.payload.percentChange >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {item.payload.percentChange >= 0 ? "+" : ""}{item.payload.percentChange.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="percentChange" radius={[0, 4, 4, 0]} barSize={16}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.percentChange >= 0 ? "oklch(0.65 0.18 140)" : "oklch(0.6 0.18 29)"}
                />
              ))}
              <LabelList
                dataKey="pk"
                position="insideLeft"
                offset={8}
                className="fill-accent"
                fontSize={12}
              />
              <LabelList
                dataKey="percentChange"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
