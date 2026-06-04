import Link from "next/link";
import { Trophy } from "lucide-react";
import { Hero } from "@/components/landing/hero";
import { EventCallouts } from "@/components/landing/event-callout";
import { NeighborhoodGrid } from "@/components/landing/neighborhood-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ULTIMATE_QUEST_IDS } from "@/lib/data/quests";

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />

      <div className="mx-auto max-w-5xl px-4 py-12 space-y-12">
        <section>
          <h2 className="text-2xl font-bold mb-1">This Summer in Philly</h2>
          <p className="text-muted-foreground mb-6">
            Two massive events. One legendary city. Your adventure starts here.
          </p>
          <EventCallouts />
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-1">Neighborhood Quests</h2>
          <p className="text-muted-foreground mb-6">
            Pick a neighborhood, complete 5 objectives, earn your stamp. Each
            quest is fully walkable.
          </p>
          <NeighborhoodGrid />
        </section>

        <section>
          <Link href="/ultimate" className="block group">
            <Card className="border-2 border-dashed border-primary/30 bg-primary/[0.02] hover:border-primary/50 hover:bg-primary/[0.04] transition-all">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  The Ultimate Philly Quest
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Think you can handle it? {ULTIMATE_QUEST_IDS.length}{" "}objectives
                  spanning every corner of the city. The full Philadelphia
                  experience — from Rocky Steps to Reading Terminal, Poe&apos;s
                  house to the World Cup.
                </p>
                <Button
                  variant="outline"
                  tabIndex={-1}
                  className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                >
                  Accept the Challenge
                </Button>
              </CardContent>
            </Card>
          </Link>
        </section>

        <footer className="text-center text-sm text-muted-foreground py-8 border-t">
          <p>Side Quest Philadelphia — Summer 2026</p>
          <p className="mt-1">Made with love for the city of Philadelphia.</p>
        </footer>
      </div>
    </main>
  );
}
