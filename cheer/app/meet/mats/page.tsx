import type { Metadata } from "next";
import { Suspense } from "react";
import { Mats } from "@/components/mats";

export const metadata: Metadata = { title: "Mats" };

// Static on purpose: `?mat=` is read on the client (useSearchParams), so the
// prerendered page and its prefetched payload also serve this tab offline.
export default function MatsPage() {
  return (
    <Suspense>
      <Mats />
    </Suspense>
  );
}
