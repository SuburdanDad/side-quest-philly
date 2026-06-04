import type { ObjectiveCategory } from "@/lib/types";
import { CATEGORY_CONFIG } from "@/lib/types";

export function CategoryBadge({ category }: { category: ObjectiveCategory }) {
  const config = CATEGORY_CONFIG[category];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.color}`}
    >
      {config.label}
    </span>
  );
}
