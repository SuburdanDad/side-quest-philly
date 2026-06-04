import { SUMMER_EVENTS } from "@/lib/data/events";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EventCallouts() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SUMMER_EVENTS.map((event) => (
        <Card key={event.id} className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              {event.dateRange}
            </CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-2xl">{event.emoji}</span>
              {event.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {event.description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {event.venue}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
