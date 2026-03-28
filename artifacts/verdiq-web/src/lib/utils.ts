import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMetricValue(key: string, value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  
  switch (key) {
    case "roe":
    case "revenue_growth_cagr_pct":
    case "profit_margin_pct":
      return `${value.toFixed(2)}%`;
    case "de_ratio":
      return `${value.toFixed(2)}x`;
    case "pe_ratio":
      return `${value.toFixed(2)}`;
    case "free_cashflow":
      if (Math.abs(value) >= 1e9) {
        return `$${(value / 1e9).toFixed(2)}B`;
      }
      if (Math.abs(value) >= 1e6) {
        return `$${(value / 1e6).toFixed(2)}M`;
      }
      return `$${value.toLocaleString()}`;
    default:
      return value.toString();
  }
}

export function getMetricLabel(key: string): string {
  const labels: Record<string, string> = {
    roe: "Return on Equity",
    revenue_growth_cagr_pct: "Rev Growth CAGR",
    profit_margin_pct: "Profit Margin",
    de_ratio: "Debt/Equity Ratio",
    pe_ratio: "P/E Ratio",
    free_cashflow: "Free Cash Flow",
  };
  return labels[key] || key;
}
