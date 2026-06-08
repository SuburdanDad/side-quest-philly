import type { Neighborhood } from "@/lib/types";
import {
  RITTENHOUSE_OBJECTIVES,
  MIDTOWN_VILLAGE_OBJECTIVES,
  OLD_CITY_OBJECTIVES,
  NORTHERN_LIBERTIES_OBJECTIVES,
  SOUTH_PHILLY_OBJECTIVES,
  STADIUM_OBJECTIVES,
  CHINATOWN_OBJECTIVES,
  MANAYUNK_OBJECTIVES,
  UNIVERSITY_CITY_OBJECTIVES,
} from "./quests";

export const NEIGHBORHOODS: Neighborhood[] = [
  {
    id: "old-city",
    slug: "old-city",
    name: "Old City",
    tagline: "America started here",
    description:
      "Cobblestone streets, colonial history, and a thriving art gallery scene steps from the Liberty Bell.",
    emoji: "🔔",
    color: "#B45309",
    objectives: OLD_CITY_OBJECTIVES,
  },
  {
    id: "rittenhouse",
    slug: "rittenhouse",
    name: "Rittenhouse",
    tagline: "Where brunch is a contact sport",
    description:
      "Tree-lined streets, world-class dining, and one of the most beautiful public squares in America.",
    emoji: "🌳",
    color: "#2D6A4F",
    objectives: RITTENHOUSE_OBJECTIVES,
  },
  {
    id: "midtown-village",
    slug: "midtown-village",
    name: "Midtown Village",
    tagline: "Culture, flavor, and zero chill",
    description:
      "Home to the Gayborhood and Reading Terminal Market — Philly's most eclectic neighborhood.",
    emoji: "🌈",
    color: "#7C3AED",
    objectives: MIDTOWN_VILLAGE_OBJECTIVES,
  },
  {
    id: "chinatown",
    slug: "chinatown",
    name: "Chinatown",
    tagline: "Flavor, history, and karaoke",
    description:
      "One of the oldest Chinatowns in the US, packed with incredible food, cultural landmarks, and the iconic Friendship Gate.",
    emoji: "🏮",
    color: "#DC2626",
    objectives: CHINATOWN_OBJECTIVES,
  },
  {
    id: "northern-liberties",
    slug: "northern-liberties",
    name: "Northern Liberties",
    tagline: "Philly's creative engine",
    description:
      "Former industrial district turned hip hub of breweries, street art, and some of the best pizza in the city.",
    emoji: "🎨",
    color: "#0891B2",
    objectives: NORTHERN_LIBERTIES_OBJECTIVES,
  },
  {
    id: "south-philly",
    slug: "south-philly",
    name: "South Philly & Passyunk",
    tagline: "Cheesesteaks, murals, and Rocky steps",
    description:
      "The soul of Philadelphia — the Italian Market, East Passyunk dining, and the iconic Art Museum steps.",
    emoji: "🥊",
    color: "#E81828",
    objectives: SOUTH_PHILLY_OBJECTIVES,
  },
  {
    id: "university-city",
    slug: "university-city",
    name: "University City",
    tagline: "Brains, food trucks, and river views",
    description:
      "Home to Penn and Drexel, world-class museums, the best food truck scene in the city, and the floating Schuylkill boardwalk.",
    emoji: "🎓",
    color: "#1E40AF",
    objectives: UNIVERSITY_CITY_OBJECTIVES,
  },
  {
    id: "manayunk",
    slug: "manayunk",
    name: "Manayunk",
    tagline: "The hill will test you",
    description:
      "A riverside neighborhood with a historic canal, steep hills, craft breweries, and a Main Street packed with restaurants.",
    emoji: "🚵",
    color: "#65A30D",
    objectives: MANAYUNK_OBJECTIVES,
  },
  {
    id: "stadium-district",
    slug: "stadium-district",
    name: "Stadium District",
    tagline: "Where champions play",
    description:
      "Home to the Eagles, Phillies, Sixers, and Flyers — and this summer, the World Cup and All-Star Game.",
    emoji: "🏟️",
    color: "#004C54",
    objectives: STADIUM_OBJECTIVES,
  },
];

export function getNeighborhoodBySlug(slug: string): Neighborhood | undefined {
  return NEIGHBORHOODS.find((n) => n.slug === slug);
}

export function getAllObjectives() {
  return NEIGHBORHOODS.flatMap((n) => n.objectives);
}
