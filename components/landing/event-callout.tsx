import { SUMMER_EVENTS } from "@/lib/data/events";

export function EventCallouts() {
  return (
    <div className="space-y-2.5">
      {SUMMER_EVENTS.map((event) => (
        <div
          key={event.id}
          className="flex items-center gap-3 rounded-xl border bg-card p-3.5"
        >
          <span className="text-2xl flex-shrink-0">{event.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{event.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {event.dateRange} — {event.venue}
            </p>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
        <span className="text-2xl flex-shrink-0">🇺🇸</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">America 250</p>
          <p className="text-[11px] text-muted-foreground">
            All summer — Celebrating 250 years since the founding in
            Philadelphia
          </p>
        </div>
      </div>
    </div>
  );
}
