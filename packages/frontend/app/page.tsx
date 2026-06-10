"use client";

import { useEffect, useState } from "react";
import { MoversHeader } from "@/components/movers/movers-header";
import { MetricsRow } from "@/components/movers/metrics-row";
import { MoversChart } from "@/components/movers/movers-chart";
import { HistoryTable } from "@/components/movers/history-table";

interface Mover {
  pk: string;
  sk: string;
  percentChange: number;
  close: number;
}

const formatDate = (dateStr: string) => {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const month = parts[1];
  const day = parts[2];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIdx = parseInt(month, 10) - 1;
  return `${months[monthIdx] || month} ${parseInt(day, 10)}`;
};

export default function Home() {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "https://n4ljb93oae.execute-api.us-east-1.amazonaws.com/prod/";
    const fetchUrl = apiBaseUrl.endsWith("/") ? `${apiBaseUrl}movers` : `${apiBaseUrl}/movers`;

    fetch(fetchUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch market data");
        return res.json();
      })
      .then((json) => {
        if (json.success) setMovers(json.data);
        else setError(json.message || "Failed to load movers data");
      })
      .catch((err) => setError(err.message || "An unexpected error occurred."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-4 sm:p-8 text-center text-sm text-muted-foreground min-h-[50vh] flex items-center justify-center">
        Loading market data...
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6 sm:space-y-8 w-full overflow-hidden">
      <MoversHeader />

      {error && (
        <div className="p-4 rounded border border-destructive bg-destructive/10 text-xs text-destructive">
          Error: {error}
        </div>
      )}

      {!error && movers.length > 0 && (
        <>
          <MetricsRow movers={movers} />
          <MoversChart movers={movers} formatDate={formatDate} />
          <HistoryTable movers={movers} formatDate={formatDate} />
        </>
      )}

      {!error && movers.length === 0 && (
        <div className="text-center py-12 border border-dashed rounded text-sm text-muted-foreground">
          No market data available.
        </div>
      )}
    </main>
  );
}