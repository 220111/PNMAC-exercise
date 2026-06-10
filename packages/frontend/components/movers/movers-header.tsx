"use client";

export function MoversHeader() {
  return (
    <header className="border-b pb-4">
      <h1 className="text-xl font-semibold">Daily Market Movers</h1>
      <p className="text-xs text-muted-foreground mt-1">
        Top daily stock performers based on percentage gain (Last 7 Days)
      </p>
    </header>
  );
}
