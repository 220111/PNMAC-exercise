"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface Mover {
  pk: string;
  sk: string;
  percentChange: number;
  close: number;
}

interface HistoryTableProps {
  movers: Mover[];
  formatDate: (dateStr: string) => string;
}

export function HistoryTable({ movers, formatDate }: HistoryTableProps) {
  if (movers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>History Details</CardTitle>
        <CardDescription>
          Chronological log of daily top performers
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Date</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Close Price</TableHead>
              <TableHead className="text-right pr-4">Daily Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movers.map((item) => (
              <TableRow key={item.sk}>
                <TableCell className="pl-4">{formatDate(item.sk)}</TableCell>
                <TableCell>
                  <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">
                    {item.pk}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono">${item.close.toFixed(2)}</TableCell>
                <TableCell className={`text-right pr-4 font-medium ${item.percentChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {item.percentChange >= 0 ? "▲" : "▼"} {Math.abs(item.percentChange).toFixed(2)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
