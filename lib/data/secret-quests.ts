import type { Objective, Neighborhood } from "@/lib/types";

export type SecretQuest = Neighborhood & {
  /** Number of completed neighborhoods required to unlock this quest */
  unlockRequirement: number;
  /** Short label shown on the locked card */
  unlockLabel: string;
};

export const TIMS_FAVORITES_OBJECTIVES: Objective[] = [
  // History — the foundations
  {
    id: "timf-05",
    title: "Pay Your Respects to Ben",
    description:
      "Visit Ben Franklin's grave at Christ Church Burial Ground. Toss a penny on the headstone — it's tradition. The godfather of Philadelphia, freedom, and arguably the greatest American to ever live. We all owe him a debt of gratitude.",
    hint: "5th and Arch Streets, right at the corner. The grave is visible through the iron fence, but go inside ($5) to stand at it properly. The penny tradition brings good luck.",
    category: "history",
    funFact:
      "Franklin's epitaph, which he wrote himself at age 22, reads: 'The body of B. Franklin, Printer... will appear once more in a new and more elegant edition.' His actual gravestone simply reads 'Benjamin and Deborah Franklin, 1790.'",
  },
  {
    id: "timf-07",
    title: "Birthplace of the Marines",
    description:
      "Find the Tun Tavern historical marker — the birthplace of the United States Marine Corps. Freedom isn't free, and there's no such thing as a 'former' Marine. Semper fidelis.",
    hint: "The marker is on Front Street near Walnut, in the area where Tun Tavern once stood. The original tavern was demolished in 1781, but the marker keeps the memory alive.",
    category: "history",
    funFact:
      "On November 10, 1775, the Continental Congress authorized the raising of two battalions of Marines at Tun Tavern. Captain Samuel Nicholas recruited the first Marines right here, many of them over pints of ale.",
  },
  {
    id: "timf-03",
    title: "America's Oldest Bar",
    description:
      "Drink at McGillin's Olde Ale House — the oldest continuously operated bar in the country, open since 1860. It's on every Philly list imaginable, and it should be. Not a hidden spot by any means, but a mandatory stop for anyone who wants to understand what Philly is about.",
    hint: "1310 Drury St, tucked in an alley between 13th and Juniper. Look for the narrow alley entrance — it's easy to walk past. The upstairs and downstairs are different vibes.",
    category: "history",
    funFact:
      "McGillin's opened the same year Abraham Lincoln was elected president. It survived Prohibition by selling 'near beer' and food. The bar has been run by just two families in over 160 years.",
  },

  // Culture — the soul
  {
    id: "timf-04",
    title: "Waterworks & Boathouse Row",
    description:
      "Walk along the Schuylkill from the Waterworks to Boathouse Row. Take in the iconic landscape — fresh air, Fairmount Park, beautiful gardens, and people being active. Then walk up into Fairmount and grab a Guinness at the Black Taxi.",
    hint: "Start at the Waterworks behind the Art Museum. Walk north along Kelly Drive past Boathouse Row. When you're done, cross back into Fairmount — Black Taxi is at 2222 Fairmount Ave.",
    category: "culture",
    funFact:
      "The Fairmount Waterworks was one of the first large-scale municipal water systems in America, built in 1815. It made Philadelphia the first city to provide clean water to all its citizens. Boathouse Row's 15 historic rowing clubs have been racing on the Schuylkill since the 1850s.",
  },

  // Entertainment — the experience
  {
    id: "timf-08",
    title: "Section 104, Citizens Bank Park",
    description:
      "Catch a Phillies game and soak it in from the stands. Nothing puts your finger on the pulse of the city better than a warm summer night at the ballpark. Grab some food and drink, and think about what other adventures await you next.",
    hint: "Section 104 is Tim's favorite seat, but anywhere works. Citizens Bank Park is at 1 Citizens Bank Way in South Philly. Get there early for batting practice and explore Ashburn Alley.",
    category: "entertainment",
    funFact:
      "Citizens Bank Park opened in 2004 and holds 42,792 fans. The Liberty Bell in center field rings and lights up after every Phillies home run. Philly fans are the most passionate in baseball — and they'll let you know it.",
  },

  // Food & Drink — the essentials
  {
    id: "timf-01",
    title: "The OG Cheesesteak",
    description:
      "Make the pilgrimage to Dalessandro's in Roxborough. For a long time, it was the best cheesesteak in the city. Others have surpassed it, but you should never forget the OGs who made the cheesesteak the iconic sandwich that it is.",
    hint: "600 Wendover St, in Roxborough. It's a hike from Center City but that's the point — the best things aren't on the tourist map. Cash only, line moves fast.",
    category: "food-beverage",
    funFact:
      "Dalessandro's has been serving cheesesteaks since 1960. For decades, locals considered it the best in the city — a title the tourist spots on 9th Street never held among real Philadelphians.",
  },
  {
    id: "timf-02",
    title: "Best Burger in the City",
    description:
      "Get the burger at Good Dog Bar. Good Dog is the type of place every real city needs — it caters to people from all walks of life and has the best burger in Philadelphia. No debate.",
    hint: "224 S 15th St, in the heart of Center City. The burger is stuffed with Roquefort cheese. Pair it with a local draft. The upstairs bar is cozier than downstairs.",
    category: "food-beverage",
    funFact:
      "Good Dog Bar opened in 2005 and has been named best burger in Philadelphia by virtually every publication in the city. The signature burger is stuffed with a molten core of Roquefort cheese that explodes when you bite in.",
  },
  {
    id: "timf-06",
    title: "Standard Tap's Rooftop",
    description:
      "Grab a seat on the upstairs patio at Standard Tap in Northern Liberties. Not new or trendy, just awesome. Standard Tap is the perfect blend of old Philly and new Philly. Order a local beer and enjoy some of the best food around.",
    hint: "901 N 2nd St, at the corner of Poplar in Northern Liberties. Head straight upstairs for the patio. They only serve local and regional beers — no macros. The deviled eggs are a must.",
    category: "food-beverage",
    funFact:
      "Standard Tap was one of the first bars in Philadelphia to serve exclusively local and regional craft beers when it opened in 1999. It helped spark the entire Northern Liberties neighborhood renaissance.",
  },
];

export const TIMS_FAVORITES: SecretQuest = {
  id: "tims-favorites",
  slug: "tims-favorites",
  name: "Tim's Favorites",
  tagline: "The real Philly, from someone who lives it",
  description:
    "You've proven you're more than a tourist. These are Tim's 8 personal favorite things to do in Philadelphia — deeper cuts, real spots, local institutions. History, food, beer, baseball, and the places that make Philly feel like home.",
  emoji: "🤫",
  color: "#C9A84C",
  objectives: TIMS_FAVORITES_OBJECTIVES,
  unlockRequirement: 2,
  unlockLabel: "Complete 2 neighborhoods to unlock",
};

export function isSecretQuestUnlocked(
  completedNeighborhoods: string[],
  quest: SecretQuest = TIMS_FAVORITES,
): boolean {
  return completedNeighborhoods.length >= quest.unlockRequirement;
}
