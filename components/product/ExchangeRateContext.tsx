"use client";

import { createContext, type ReactNode } from "react";
import { DEFAULT_USD_EXCHANGE_RATE } from "@/lib/exchange-rate";

export const ExchangeRateContext = createContext(DEFAULT_USD_EXCHANGE_RATE);

export function ExchangeRateProvider({ rate, children }: { rate: number; children: ReactNode }) {
  return <ExchangeRateContext value={rate}>{children}</ExchangeRateContext>;
}
