import type { Objective } from "@/lib/types";

/**
 * CHAPTER II — the second content wave. Five fresh stops per
 * neighborhood so finishing a quest is the beginning, not the end.
 *
 * Rules for every wave (see CLAUDE.md "Adding a content wave"):
 * - ids are `{prefix}2-NN` — never reuse a prior id
 * - chapters NEVER join NEIGHBORHOODS.objectives (stamps stay = the
 *   original five; leaderboard stamp SQL filters on counts_for_stamp)
 * - every wave ships with a matching DB migration (quests row with
 *   counts_for_stamp=false + objectives rows) so sync FKs and
 *   leaderboard XP keep working
 */

export const CHAPTER_II: Record<string, Objective[]> = {
  "old-city": [
    {
      id: "oldc2-01",
      title: "Carpenters' Hall Huddle",
      description:
        "Find Carpenters' Hall, tucked in its quiet courtyard off Chestnut. The First Continental Congress met here in 1774 — before Independence Hall got all the credit.",
      hint: "320 Chestnut St, set back from the street down a brick walkway. Free to enter most days; the courtyard photo counts even when it's closed.",
      category: "history",
      funFact:
        "The building is still owned by the Carpenters' Company, a builders' guild founded in 1724 — the oldest trade guild in America.",
    },
    {
      id: "oldc2-02",
      title: "Mail It Like Franklin",
      description:
        "Send a postcard from the B. Free Franklin Post Office, where every piece of mail gets hand-stamped with Ben's colonial postmark.",
      hint: "316 Market St, inside Franklin Court. Buy a postcard nearby, address it to yourself — it's the cheapest souvenir in the city.",
      category: "culture",
      funFact:
        "It's the only active U.S. post office that doesn't fly an American flag — when Franklin was postmaster, there wasn't a United States yet.",
    },
    {
      id: "oldc2-03",
      title: "Race Street Pier Golden Hour",
      description:
        "Walk out onto Race Street Pier and stand directly under the Ben Franklin Bridge as it hums overhead.",
      hint: "Columbus Blvd at Race St, a 5-minute walk from Elfreth's Alley. Sunset is the move — the bridge lights come on as the sky goes pink.",
      category: "entertainment",
      funFact:
        "The pier was redesigned by James Corner Field Operations — the same studio behind New York's High Line. The bridge above was the world's longest suspension span when it opened in 1926.",
    },
    {
      id: "oldc2-04",
      title: "Bourse Food Hall Raid",
      description:
        "Eat something — anything — inside The Bourse, the 1895 trading floor turned food hall across from the Liberty Bell.",
      hint: "111 S Independence Mall East. A dozen vendors under one soaring atrium; weekday lunch is liveliest.",
      category: "food-beverage",
      funFact:
        "When it opened in 1895, the Bourse housed one of America's earliest commodities exchanges — grain deals where the tacos are now.",
    },
    {
      id: "oldc2-05",
      title: "Khyber Pass Nightcap",
      description:
        "Close the chapter with a beer at Khyber Pass Pub, Old City's gloriously scruffy elder statesman.",
      hint: "56 S 2nd St. Look up at the hand-carved Victorian backbar, then order something Cajun — the kitchen seriously outpunches the room.",
      category: "food-beverage",
      funFact:
        "The ornate backbar is said to have crossed the Atlantic in the 1870s, and the room spent decades as one of Philly's legendary punk venues before the po' boys moved in.",
    },
  ],

  rittenhouse: [
    {
      id: "ritt2-01",
      title: "Curtis Institute Soundcheck",
      description:
        "Find the Curtis Institute of Music on the square's east side, where some of the world's best young musicians train for free.",
      hint: "1726 Locust St — the mansion with the discreet nameplate. Check the posters by the door; student recitals are often free and open to anyone.",
      category: "history",
      funFact:
        "Curtis has been tuition-free for every student since 1928. Leonard Bernstein and Samuel Barber both walked these halls.",
    },
    {
      id: "ritt2-02",
      title: "Print Center Treasure Hunt",
      description:
        "Slip into The Print Center on Latimer Street — a century-old gallery hiding in plain sight one block off the square.",
      hint: "1614 Latimer St, a tiny street between Spruce and Locust. Free admission; the back gallery is the good stuff.",
      category: "culture",
      funFact:
        "Founded in 1915, it's one of the oldest institutions in the country devoted entirely to prints and photographs.",
    },
    {
      id: "ritt2-03",
      title: "Helium Giggle Check",
      description:
        "Catch a set at Helium Comedy Club — or at least snap the marquee and see who's in town this weekend.",
      hint: "2031 Sansom St. Wednesday open mics are cheap; weekend headliners sell out, so book ahead.",
      category: "entertainment",
      funFact:
        "The room seats under 300, which is why touring comics love it — and why crowd work here gets dangerously personal.",
    },
    {
      id: "ritt2-04",
      title: "Draft Latte at the Source",
      description:
        "Order a draft latte at La Colombe's Rittenhouse cafe — the drink was invented by this Philly-born roaster.",
      hint: "130 S 19th St, half a block off the square. Get it on draft, not over ice — that's the whole point.",
      category: "food-beverage",
      funFact:
        "La Colombe started in Philadelphia in 1994 and poured its way into cafes nationwide — the textured, nitro-style draft latte is the hometown claim to fame.",
    },
    {
      id: "ritt2-05",
      title: "Buck-a-Shuck Reconnaissance",
      description:
        "Hit Oyster House on Sansom Street for happy-hour oysters and a snapper soup education.",
      hint: "1516 Sansom St. Weekday happy hour at the marble bar is the play — come early, the stools go fast.",
      category: "food-beverage",
      funFact:
        "The Mink family has been shucking oysters in Philadelphia since 1947 — three generations of the same family behind the same craft.",
    },
  ],

  "midtown-village": [
    {
      id: "midv2-01",
      title: "Nation's First Hospital",
      description:
        "Stand at the gates of Pennsylvania Hospital and look down the lawn at the Pine Building — American medicine started here.",
      hint: "8th & Spruce. The historic Pine Building facade is best from the garden side on Pine Street.",
      category: "history",
      funFact:
        "Benjamin Franklin and Dr. Thomas Bond founded it in 1751 as the colonies' first hospital. The surgical amphitheater upstairs predates anesthesia — patients got rum.",
    },
    {
      id: "midv2-02",
      title: "Giovanni's Room Browse",
      description:
        "Browse the shelves at Giovanni's Room, the oldest LGBTQ+ bookstore in America, still anchoring 12th Street.",
      hint: "345 S 12th St — run today as Philly AIDS Thrift @ Giovanni's Room. Books up front, treasure-hunt thrift in the back rooms.",
      category: "culture",
      funFact:
        "Open since 1973 and named after James Baldwin's novel, it survived eras when carrying its books took genuine courage.",
    },
    {
      id: "midv2-03",
      title: "Quizzo Night at Fergie's",
      description:
        "Pull up a stool at Fergie's Pub for quizzo, an open mic, or whatever's pouring out of the upstairs room tonight.",
      hint: "1214 Sansom St. Cash-friendly, TV-free by design — talk to the person next to you, that's the house rule.",
      category: "entertainment",
      funFact:
        "Fergus Carey opened the pub in 1994 and helped make quizzo a Philadelphia institution — the city argues about where it started, but everyone agrees where it's best.",
    },
    {
      id: "midv2-04",
      title: "Double Knot Descent",
      description:
        "Walk into the calm daytime coffee shop at Double Knot, then find the staircase — there's a whole izakaya hiding underneath.",
      hint: "120 S 13th St. Coffee and banh mi upstairs all day; the subterranean robatayaki den opens for dinner.",
      category: "food-beverage",
      funFact:
        "It's Midtown Village's worst-kept secret: a Clark Kent coffee bar with a Superman basement.",
    },
    {
      id: "midv2-05",
      title: "Lowrider Margarita",
      description:
        "Order a margarita at El Vez and find the glittering lowrider bicycle — the most photographed bike in Philadelphia.",
      hint: "121 S 13th St. The guacamole is made tableside; the bike is impossible to miss.",
      category: "food-beverage",
      funFact:
        "El Vez has held down this corner since 2003 — one of the restaurants that turned 13th Street from sketchy to packed.",
    },
  ],

  "south-philly": [
    {
      id: "sphl2-01",
      title: "Old Swedes' Sanctuary",
      description:
        "Visit Gloria Dei (Old Swedes') Church, the oldest church in Pennsylvania — older than the city's grid itself.",
      hint: "Columbus Blvd & Christian St, tucked between the highway and the river. The churchyard is open most days; the brick path in is the photo.",
      category: "history",
      funFact:
        "Built 1698–1700 by Swedish settlers who were here before William Penn. Betsy Ross was married here — her first wedding, the one history forgets.",
    },
    {
      id: "sphl2-02",
      title: "Magic Gardens Maze",
      description:
        "Get lost inside Philadelphia's Magic Gardens, Isaiah Zagar's half-block labyrinth of mirror, tile, and bottle walls.",
      hint: "1020 South St. Book the timed ticket online in summer; the indoor grottoes stay cool when the sidewalk bakes.",
      category: "culture",
      funFact:
        "Zagar has been mosaicking South Philly walls since the late 1960s — over 200 public works across the city, with this as the mothership.",
    },
    {
      id: "sphl2-03",
      title: "Bok Rooftop Sunset",
      description:
        "Ride up to Bok Bar's rooftop and catch the skyline from atop a 1930s vocational school turned maker beehive.",
      hint: "800 Mifflin St, enter on 8th. Summer evenings only — the line moves fast, the view is worth it.",
      category: "entertainment",
      funFact:
        "The Art Deco Bok Technical High School closed in 2013; now its classrooms hold woodworkers, tattooers, bakers, and the city's best non-skyscraper view.",
    },
    {
      id: "sphl2-04",
      title: "Termini Bros Cannoli Run",
      description:
        "Order a cannoli filled to order at Termini Brothers, the 8th Street pasticceria that outlasted a century of trends.",
      hint: "1523 S 8th St. Watch them pipe the ricotta fresh — never accept a pre-filled cannoli, that's the Termini lesson.",
      category: "food-beverage",
      funFact:
        "Open since 1921, founded by two brothers from Sicily. The neon sign alone is worth the walk.",
    },
    {
      id: "sphl2-05",
      title: "Water Ice the Right Way",
      description:
        "Cool down at John's Water Ice — and pronounce it 'wooder ice' or be gently corrected by everyone in line.",
      hint: "701 Christian St, at 7th. Cherry and lemon are the canon; cash moves the line faster.",
      category: "food-beverage",
      funFact:
        "John's has been scooping on this corner since 1945. Water ice is Philly's official summer food group.",
    },
  ],

  "stadium-district": [
    {
      id: "stad2-01",
      title: "Navy Yard Expedition",
      description:
        "Venture past the stadiums to the Navy Yard and find the mothballed warships resting in the reserve basin.",
      hint: "Keep going south on Broad until the gate — it's open to the public. The ships are visible from the waterfront along the basin.",
      category: "history",
      funFact:
        "The Philadelphia Naval Shipyard's lineage goes back to 1801, and its workers built and overhauled hundreds of Navy vessels before closing in 1995 — it's now a 1,200-acre innovation campus.",
    },
    {
      id: "stad2-02",
      title: "Central Green Wander",
      description:
        "Find Central Green inside the Navy Yard — a ring-shaped park dropped between office buildings like a crop circle.",
      hint: "Inside the Navy Yard campus, off League Island Blvd. Hammocks, a sunken lawn, and corporate architecture that's weirdly worth photographing.",
      category: "culture",
      funFact:
        "Central Green was designed by James Corner Field Operations — the High Line studio shows up twice on this scavenger hunt, which tells you something about Philly's parks game.",
    },
    {
      id: "stad2-03",
      title: "Sportsbook Energy Check",
      description:
        "Walk the floor at Live! Casino in the stadium shadow — game-day crowds sweating their parlays is its own spectator sport.",
      hint: "900 Packer Ave, next to Xfinity Live!. 21+ only — if that's not your scene, soak in the pregame chaos outside instead.",
      category: "entertainment",
      funFact:
        "It opened in 2021 directly inside the stadium complex — on a Phillies/Sixers/Eagles triple-header weekend, this block might be the loudest square mile in Pennsylvania.",
    },
    {
      id: "stad2-04",
      title: "Crabfries Communion",
      description:
        "Order Crabfries at the original Chickie's & Pete's — crinkle-cut, crab-seasoned, dunked in white sauce, no substitutions.",
      hint: "1526 Packer Ave. Go before the game or long after the final whistle, or budget serious line time.",
      category: "food-beverage",
      funFact:
        "Crabfries were invented here in 1977 as a way to use leftover crab seasoning in the offseason. Now they outsell the crabs.",
    },
    {
      id: "stad2-05",
      title: "Roast Pork Rite of Passage",
      description:
        "Order the roast pork Italian at Tony Luke's — sharp provolone, broccoli rabe, and the sandwich locals argue beats the cheesesteak.",
      hint: "39 E Oregon Ave, under I-95. Stand at the outdoor counter like everyone before you.",
      category: "food-beverage",
      funFact:
        "Ask a Philadelphian for the city's best sandwich and watch them whisper 'honestly... the roast pork' while looking over their shoulder.",
    },
  ],

  "northern-liberties": [
    {
      id: "nlib2-01",
      title: "The Saint of Girard Avenue",
      description:
        "Visit the National Shrine of St. John Neumann, where America's first canonized male saint rests in a glass altar.",
      hint: "1019 N 5th St at Girard. Free, quiet, and genuinely unlike anything else on this hunt — respectful photos welcome.",
      category: "history",
      funFact:
        "Neumann was Philadelphia's bishop in the 1850s and founded the first unified Catholic school system in America. He was canonized in 1977.",
    },
    {
      id: "nlib2-02",
      title: "Crane Arts Open Door",
      description:
        "Poke into the Crane Arts Building, a century-old plumbing factory now packed with artist studios and the cavernous Icebox gallery.",
      hint: "1400 N American St. Second Thursday evenings are open-studio night — the building unlocks and the artists pour wine.",
      category: "culture",
      funFact:
        "The Icebox Project Space is a former cold-storage room so big that artists stage entire installations, film shoots, and indoor fog inside it.",
    },
    {
      id: "nlib2-03",
      title: "Ortlieb's Late Set",
      description:
        "Catch live music at Ortlieb's, the brewery-bottling-house-turned-club where the back room stays loud past midnight.",
      hint: "847 N 3rd St. Check the calendar — jazz roots, rock present, cheap cover most nights.",
      category: "entertainment",
      funFact:
        "For decades this room was Ortlieb's Jazzhaus, a legendary stage where Philly jazz greats held court among the old brewery walls.",
    },
    {
      id: "nlib2-04",
      title: "Honey's Brunch Line",
      description:
        "Earn your seat at Honey's Sit 'n Eat — Jewish deli meets Southern kitchen, the brunch that built the neighborhood's reputation.",
      hint: "800 N 4th St at Brown. Weekends mean a wait; put your name in and walk a lap of the neighborhood.",
      category: "food-beverage",
      funFact:
        "Latkes with your fried chicken is exactly the kind of fusion nobody planned and everybody defends.",
    },
    {
      id: "nlib2-05",
      title: "Abbaye Corner Pint",
      description:
        "Take the corner window at The Abbaye with a Belgian ale — the neighborhood pub that watched NoLibs grow up around it.",
      hint: "637 N 3rd St at Fairmount. The wings have a cult; the vegan menu has a bigger one.",
      category: "food-beverage",
      funFact:
        "Third Street's bar crawl gets all the press, but ask a local where they actually drink on a Tuesday and this corner comes up a lot.",
    },
  ],

  chinatown: [
    {
      id: "chnt2-01",
      title: "The Church That Fought a Highway",
      description:
        "Find Holy Redeemer Chinese Catholic Church — the community anchor that stood its ground when the Vine Street Expressway tried to erase this neighborhood.",
      hint: "915 Vine St. Read the facade, then look at the expressway trench across the street and understand what the fight was about.",
      category: "history",
      funFact:
        "When I-676 was carved through in the 1980s, community organizing saved the church and school — a defining battle in Chinatown's long history of defending its own ground.",
    },
    {
      id: "chnt2-02",
      title: "Asian Arts Initiative Stop",
      description:
        "Visit Asian Arts Initiative's gallery on Vine — community art with three decades of roots in this exact neighborhood.",
      hint: "1219 Vine St. Free gallery hours on weekdays; the exhibitions rotate constantly.",
      category: "culture",
      funFact:
        "AAI grew out of a 1993 response to racial tension in the city — thirty years of making art the connective tissue between Chinatown and everyone else.",
    },
    {
      id: "chnt2-03",
      title: "Rail Park Skyline Walk",
      description:
        "Climb up to the Rail Park and walk the old Reading Viaduct — elevated tracks turned park, with rooftop views of Chinatown North.",
      hint: "Entrance at Broad & Noble, a short walk up 13th from the Friendship Gate. Golden hour turns the catwalk gold.",
      category: "entertainment",
      funFact:
        "These tracks carried Reading Railroad trains starting in the 1890s. Phase one of the park opened in 2018 — the full vision runs three miles.",
    },
    {
      id: "chnt2-04",
      title: "Soup Dumpling Surgery",
      description:
        "Master the xiao long bao protocol at Dim Sum Garden: bite, sip the soup, then eat — in that order, no exceptions.",
      hint: "1020 Race St. Get the pork XLB and the hand-drawn noodles; watch the dough get pulled behind the glass.",
      category: "food-beverage",
      funFact:
        "The soup gets inside the dumpling as a cube of gelatinized broth that melts when steamed — culinary engineering older than the republic.",
    },
    {
      id: "chnt2-05",
      title: "Egg Tart Victory Lap",
      description:
        "Finish with a warm egg tart from KC's Pastries — flaky, wobbly, and gone in two bites.",
      hint: "109 N 10th St. If the tarts just came out, buy more than one. You'll learn this lesson either way.",
      category: "food-beverage",
      funFact:
        "The egg tart traveled from Portugal to Macau to Hong Kong to 10th Street — colonial history you can eat for a couple bucks.",
    },
  ],

  manayunk: [
    {
      id: "mnyk2-01",
      title: "Pretzel Park Twist",
      description:
        "Find the pretzel statue in Pretzel Park and walk the looping paths that gave the park its name.",
      hint: "4300 Silverwood St, across from the train station. Yes, the paths really are shaped like a pretzel — check the satellite view.",
      category: "history",
      funFact:
        "Manayunk comes from the Lenape word 'manaiung' — roughly 'where we go to drink.' The neighborhood has honored the name ever since.",
    },
    {
      id: "mnyk2-02",
      title: "Venice Island Discovery",
      description:
        "Cross the canal bridge to Venice Island — a sliver of land between canal and river hiding a performing arts center and sculpture.",
      hint: "Enter at Lock Street off Main. The island sits BETWEEN the canal and the Schuylkill — most visitors never realize it's there.",
      category: "culture",
      funFact:
        "The island spent a century as mill yards and parking; now it's a rec center and venue engineered to flood gracefully when the river rises.",
    },
    {
      id: "mnyk2-03",
      title: "Bridge to Nowhere Trek",
      description:
        "Walk the Manayunk Bridge Trail — the great curved viaduct over the Schuylkill, now a rails-to-trails catwalk in the sky.",
      hint: "Ramp up from High Street off Main, or from the towpath. Flat, car-free, and the river views go forever.",
      category: "entertainment",
      funFact:
        "The S-curved bridge carried its last train in 1986 and reopened for walkers and bikes in 2015 — locals call the skyline-framing curve the neighborhood's best photo.",
    },
    {
      id: "mnyk2-04",
      title: "Cresson Street Hoagie Summit",
      description:
        "Order a classic Italian hoagie under the El tracks at Sorrentino's, the deli Manayunk lifers measure all others against.",
      hint: "4361 Cresson St, in the shadow of the train trestle. Cash is king; sharp provolone is correct.",
      category: "food-beverage",
      funFact:
        "Real hoagie skill is in the ratios — oil, oregano, onion, and restraint. The corner deli is Philadelphia's true culinary institution.",
    },
    {
      id: "mnyk2-05",
      title: "Goat's Beard Wind-Down",
      description:
        "Land at The Goat's Beard on Main for a proper post-hill-climb drink among the exposed brick and big windows.",
      hint: "4201 Main St. The front windows open onto the street in summer — that's the seat.",
      category: "food-beverage",
      funFact:
        "After Manayunk's infamous Wall climb humbles another batch of cyclists, this stretch of Main Street is where the survivors refuel.",
    },
  ],

  "university-city": [
    {
      id: "ucty2-01",
      title: "Furness Masterpiece Hunt",
      description:
        "Step into the lobby of the Fisher Fine Arts Library — Frank Furness's blood-red sandstone cathedral of books.",
      hint: "220 S 34th St on Penn's campus. Visitors can peek the soaring reading room from the entrance; keep voices library-low.",
      category: "history",
      funFact:
        "Furness designed more than 600 buildings in his career. When this one opened in 1891 critics called it bizarre; now it's a National Historic Landmark.",
    },
    {
      id: "ucty2-02",
      title: "ICA Free Look",
      description:
        "Walk into the Institute of Contemporary Art — always free, always strange in the best way.",
      hint: "118 S 36th St at Sansom. Admission is $0 every single day; shows turn over a few times a year.",
      category: "culture",
      funFact:
        "The ICA gave Andy Warhol his first solo museum show in 1965 — the opening got so mobbed that Warhol had to hide on a staircase.",
    },
    {
      id: "ucty2-03",
      title: "Dickens & Little Nell Picnic",
      description:
        "Find the Charles Dickens statue in Clark Park — then stay for chess tables, frisbees, and the Saturday farmers market.",
      hint: "43rd & Baltimore Ave. The statue sits in the park's north section — Dickens with Little Nell at his feet.",
      category: "entertainment",
      funFact:
        "Dickens asked that no memorials be built of him — which is why this 1890 statue is one of the only public Dickens statues on Earth.",
    },
    {
      id: "ucty2-04",
      title: "Saad's Halal Initiation",
      description:
        "Order the chicken cheesesteak or the platter at Saad's — the halal counter West Philly swears by.",
      hint: "4500 Walnut St. Lunch line out the door is normal and worth it.",
      category: "food-beverage",
      funFact:
        "The halal cheesesteak is its own genre in West Philly — and the corner-store-counter format is the most Philadelphia restaurant architecture there is.",
    },
    {
      id: "ucty2-05",
      title: "Dottie's Donut Devotion",
      description:
        "Grab a vegan donut at Dottie's — and don't tell anyone it's vegan until after they say it's the best donut they've had.",
      hint: "4529 Springfield Ave. Go early; the good flavors vanish by noon.",
      category: "food-beverage",
      funFact:
        "Dottie's built a citywide cult from a tiny West Philly storefront — the blueberry fritter has been known to end arguments.",
    },
  ],
};

export const CHAPTER_II_QUEST_SUFFIX = "-ch2";

/** Every Chapter II objective across all neighborhoods. */
export const CHAPTER_II_OBJECTIVES: Objective[] = Object.values(
  CHAPTER_II,
).flat();
