"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [movers, setMovers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMovers() {
      try {
        const res = await fetch("https://n4ljb93oae.execute-api.us-east-1.amazonaws.com/prod/movers");
        const json = await res.json();

        if (json.success) {
          setMovers(json.data);
        }
      } catch (error) {
        console.error("Failed to fetch movers", error);
      } finally {
        setLoading(false);
      }
    }

    fetchMovers();
  }, []);

  if (loading) return <div className="p-8">Loading market data...</div>;

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Top Daily Movers</h1>
      <pre>{JSON.stringify(movers, null, 2)}</pre>
    </main>
  );
}