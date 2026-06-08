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
    localSecret: {
      title: "The Ghost of Benjamin Franklin",
      description:
        "Late at night, head to Philosophical Hall on 5th Street. Through the window, you can see a life-size statue of Benjamin Franklin that's been startling passersby since 1824. Locals call it 'the ghost' because the dim lighting makes it look eerily real.",
      emoji: "👻",
    },
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
    localSecret: {
      title: "The Secret Garden at 18th & Delancey",
      description:
        "Tucked behind an iron gate on Delancey Place near 18th Street is a tiny private garden that's visible through the bars. It's one of the most peaceful spots in Center City, and most people walk right past it. The brownstones on this block are among the most expensive in Philadelphia.",
      emoji: "🌿",
    },
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
    localSecret: {
      title: "The Trestle Inn's Go-Go Dancers",
      description:
        "At 339 N 11th Street, The Trestle Inn is a whiskey bar with go-go dancers on weekend nights. It feels like stepping into 1960s Philadelphia. The drinks are strong, the music is soul and funk, and the vibe is unlike anything else in the city.",
      emoji: "💃",
    },
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
    localSecret: {
      title: "The Secret Speakeasy at Hop Sing Laundromat",
      description:
        "At 1029 Race Street, behind an unmarked door, is Hop Sing Laundromat — one of the best cocktail bars in America. No photos inside, no sneakers, no baseball caps. Ring the buzzer and hope they let you in. The cocktails are worth the mystery.",
      emoji: "🍸",
    },
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
    localSecret: {
      title: "The Secret Beach at Penn Treaty Park",
      description:
        "At the end of Columbia Avenue, Penn Treaty Park has a tiny sandy beach on the Delaware River that most people don't know exists. It's where William Penn supposedly signed his treaty with the Lenape. Bring a blanket and watch the cargo ships pass.",
      emoji: "🏖️",
    },
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
    localSecret: {
      title: "The Singing Steps of South Street",
      description:
        "At 767 South Street, the Philly Magic Gardens by Isaiah Zagar extend underground. But the real secret is the mosaic steps on nearby side streets — Zagar covered walls, alleys, and stairways for blocks. Walk the alleys between South and Bainbridge from 10th to 7th for a free outdoor art gallery.",
      emoji: "🎨",
    },
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
    localSecret: {
      title: "The Button That Does Nothing",
      description:
        "In the center of Penn's campus at 36th and Locust Walk, there's a large red button on a pedestal. Press it. It does absolutely nothing. The Split Button by Claes Oldenburg is public art that exists purely to be interacted with. Students press it for good luck on exams.",
      emoji: "🔴",
    },
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
    localSecret: {
      title: "The Ghost of the Venice Island Rec Center",
      description:
        "Venice Island, between the Manayunk Canal and the Schuylkill River, has a modern rec center built on top of a flooded foundation. The building appears to float on water. At sunset, the reflection creates an illusion that the building is sinking. Locals claim it's haunted by the ghosts of the textile workers who once labored here.",
      emoji: "🏚️",
    },
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
    localSecret: {
      title: "The Secret Tunnel Under Broad Street",
      description:
        "Under Broad Street near the stadiums, there's a network of pedestrian tunnels connecting the subway to the sports complex. During game days, thousands of fans stream through. But on off-days, the tunnels are nearly empty — and the acoustics are incredible. Sing, clap, or just listen to your footsteps echo.",
      emoji: "🚇",
    },
  },
];

export function getNeighborhoodBySlug(slug: string): Neighborhood | undefined {
  return NEIGHBORHOODS.find((n) => n.slug === slug);
}

export function getAllObjectives() {
  return NEIGHBORHOODS.flatMap((n) => n.objectives);
}
