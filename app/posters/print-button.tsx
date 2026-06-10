"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-[#0F1D36] text-white px-6 py-3 font-bold text-sm hover:bg-[#0F1D36]/90 transition-colors"
    >
      <Printer className="h-4 w-4" />
      Print all posters
    </button>
  );
}
