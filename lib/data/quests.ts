import type { Objective } from "@/lib/types";

// All neighborhoods follow the order: History → Culture → Entertainment → Food & Drink
// The idea: end somewhere fun (a restaurant, bar, or food spot) as the final objective.

export const RITTENHOUSE_OBJECTIVES: Objective[] = [
  {
    id: "ritt-02",
    title: "The Rosenbach Rendezvous",
    description:
      "Visit the Rosenbach Museum and peek at one of only 12 surviving copies of the first edition of Ulysses by James Joyce.",
    hint: "2008-2010 Delancey Place. It's a townhouse museum — easy to walk past if you're not looking for it.",
    category: "history",
    funFact:
      "The Rosenbach also holds Bram Stoker's handwritten notes for Dracula and manuscripts by Lewis Carroll.",
  },
  {
    id: "ritt-01",
    title: "Park Bench Philosopher",
    description:
      "Find a bench in Rittenhouse Square and people-watch for at least 5 minutes. Bonus points if you spot a dog in an outfit.",
    hint: "The square has benches all around the perimeter and near the central fountain. Grab a coffee from La Colombe on 19th first.",
    category: "culture",
    funFact:
      "Rittenhouse Square is one of the five original open-space parks planned by William Penn in 1682.",
  },
  {
    id: "ritt-04",
    title: "Mutter Curiosities",
    description:
      "Visit the Mütter Museum and see genuine medical oddities, including a slice of Einstein's brain and a 40-pound colon.",
    hint: "19 S 22nd Street, inside The College of Physicians of Philadelphia. Not for the squeamish!",
    category: "entertainment",
    funFact:
      "The museum's collection includes over 25,000 objects, and its wall of skulls contains 139 human crania.",
  },
  {
    id: "ritt-05",
    title: "Schuylkill Stroll",
    description:
      "Walk along the Schuylkill River Trail from the Walnut Street Bridge to at least the South Street Bridge. Take in the boathouse views.",
    hint: "Access the trail from the west side of Rittenhouse, heading toward the river on Walnut St.",
    category: "culture",
    funFact:
      "Boathouse Row, visible from the trail, is a National Historic Landmark and looks magical when lit up at night.",
  },
  {
    id: "ritt-03",
    title: "Parc Life",
    description:
      "Order a croque monsieur or a pastry at Parc and dine at one of their sidewalk tables like you're on a Parisian boulevard.",
    hint: "227 S 18th St, right on Rittenhouse Square. Try to snag a window seat or outdoor table.",
    category: "food-beverage",
    funFact:
      "Parc is a Stephen Starr restaurant modeled after a Parisian brasserie and has been a Rittenhouse staple since 2008.",
  },
];

export const MIDTOWN_VILLAGE_OBJECTIVES: Objective[] = [
  {
    id: "midv-01",
    title: "Jeweler's Row Journey",
    description:
      "Walk down Sansom Street between 7th and 8th and take in America's oldest diamond district. Window shop at least 3 jewelers.",
    hint: "Sansom Street between 7th and 8th. The whole block sparkles.",
    category: "history",
    funFact:
      "Philadelphia's Jeweler's Row dates back to 1851 and was the oldest in America until recent development changed the block.",
  },
  {
    id: "midv-03",
    title: "The Gayborhood Murals",
    description:
      "Find and photograph at least 3 rainbow street signs or murals in the Gayborhood along Locust and Walnut Streets between 11th and Broad.",
    hint: "The rainbow street signs are on every corner in this area. Look up for murals on building walls.",
    category: "culture",
    funFact:
      "Philadelphia was the first city in the US to install rainbow street signs, starting in 2007.",
  },
  {
    id: "midv-04",
    title: "Underground Comedy",
    description:
      "Catch a show at Good Good Comedy Theatre or Helium Comedy Club — Philly's comedy scene is legit.",
    hint: "Good Good is at 215 N Broad St. Helium is at 2031 Sansom St. Check their schedules online.",
    category: "entertainment",
    funFact:
      "Philly has produced comedy legends like Kevin Hart, Tina Fey, and Wanda Sykes.",
  },
  {
    id: "midv-02",
    title: "Dim Sum Dreams",
    description:
      "Get dim sum at Dim Sum Garden on Race Street. The soup dumplings are mandatory.",
    hint: "1020 Race St. Cash only, and there's almost always a line — worth the wait.",
    category: "food-beverage",
    funFact:
      "Dim Sum Garden has been serving some of the best xiao long bao outside of Shanghai since 2004.",
  },
  {
    id: "midv-05",
    title: "Reading Terminal Market Run",
    description:
      "Visit Reading Terminal Market and eat your way through at least 3 different vendors. A Philly soft pretzel from Miller's is non-negotiable.",
    hint: "12th and Arch Streets. Arrive hungry. DiNic's roast pork, Beiler's donuts, and Bassetts ice cream are crowd favorites.",
    category: "food-beverage",
    funFact:
      "Reading Terminal Market has been in operation since 1893, making it one of America's oldest continuously operating farmers' markets.",
  },
];

export const OLD_CITY_OBJECTIVES: Objective[] = [
  {
    id: "oldc-01",
    title: "Liberty Bell Selfie",
    description:
      "Visit the Liberty Bell Center and snap a photo with America's most famous cracked bell. Try to get the crack in frame.",
    hint: "526 Market Street. It's free! Lines are shorter early morning or late afternoon.",
    category: "history",
    funFact:
      "The Bell was originally cast in London in 1752 and cracked the first time it was rung. It was recast twice by local metalworkers.",
  },
  {
    id: "oldc-02",
    title: "Elfreth's Alley Explorer",
    description:
      "Walk down Elfreth's Alley, the nation's oldest continuously inhabited residential street. Count the colonial-era doors.",
    hint: "Between Front and 2nd Streets, north of Arch. The tiny museum at #124-126 is open seasonally.",
    category: "history",
    funFact:
      "Elfreth's Alley has been continuously inhabited since 1702 — over 320 years of residents.",
  },
  {
    id: "oldc-03",
    title: "First Friday Vibes",
    description:
      "Pop into at least 2 art galleries on N. 2nd or 3rd Street. Old City's gallery scene is one of the best on the East Coast.",
    hint: "Start at 2nd and Church Streets and walk north. Galleries cluster between Market and Vine on 2nd and 3rd.",
    category: "culture",
    funFact:
      "Old City First Friday events have been running since 1991, with galleries opening their doors to thousands of visitors each month.",
  },
  {
    id: "oldc-05",
    title: "Spruce Street Harbor Hangout",
    description:
      "Relax in a hammock at Spruce Street Harbor Park on the Delaware River waterfront. Grab a drink from a floating barge bar.",
    hint: "Columbus Blvd at Spruce St. The colorful LED lights and hammocks are hard to miss.",
    category: "entertainment",
    funFact:
      "The park features floating gardens and over 50 hammocks strung between trees along the river.",
  },
  {
    id: "oldc-04",
    title: "City Tavern Feast",
    description:
      "Dine where the Founding Fathers dined. Get a meal or a drink inspired by 18th-century recipes near the site of the original City Tavern.",
    hint: "138 S 2nd St. Try the Thomas Jefferson sweet potato biscuits or a colonial-era ale.",
    category: "food-beverage",
    funFact:
      "The original City Tavern was where delegates to the First Continental Congress gathered in 1774.",
  },
];

export const NORTHERN_LIBERTIES_OBJECTIVES: Objective[] = [
  {
    id: "nlib-05",
    title: "Edgar Allan Poe's House",
    description:
      "Visit the Edgar Allan Poe National Historic Site — the only surviving Poe residence in Philadelphia. Nevermore miss this one.",
    hint: "532 N 7th St. It's a National Park Service site and admission is free. Spooky vibes guaranteed.",
    category: "history",
    funFact:
      "Poe lived in this house from 1843-1844 and wrote some of his most famous works here, including 'The Black Cat.'",
  },
  {
    id: "nlib-03",
    title: "Liberty Lands Park",
    description:
      "Find Liberty Lands, a community garden and park built on a former vacant lot. Spot the community art installations.",
    hint: "900 N 3rd St. It's a hidden gem with gardens, murals, and a peaceful vibe.",
    category: "culture",
    funFact:
      "Liberty Lands was created by the Northern Liberties Neighbors Association and transformed from a dumping ground into a thriving community space.",
  },
  {
    id: "nlib-01",
    title: "Piazza People Watching",
    description:
      "Hang out at The Piazza at Schmidt's — Philly's urban town square — and see what event or market is happening.",
    hint: "1001 N 2nd St. Check their event calendar; there's often live music, markets, or movie nights.",
    category: "entertainment",
    funFact:
      "The Piazza was built on the site of the former Schmidt's brewery, which operated from 1860 to 2002.",
  },
  {
    id: "nlib-02",
    title: "Pizza Brain Pilgrimage",
    description:
      "Visit Pizza Brain, home of the world's largest collection of pizza memorabilia. Eat a slice, obviously.",
    hint: "2313 Frankford Ave (in Fishtown, short walk from NoLibs). The pizza museum is inside the restaurant.",
    category: "food-beverage",
    funFact:
      "Pizza Brain holds a Guinness World Record for the largest collection of pizza-related items — over 600 pieces.",
  },
  {
    id: "nlib-04",
    title: "Yards Brewing Co. Tasting",
    description:
      "Sample a flight at Yards Brewing Company. Try the Brawler (a Philly original) and the Philadelphia Pale Ale.",
    hint: "500 Spring Garden St. The taproom has a full restaurant and you can see the brewing operations.",
    category: "food-beverage",
    funFact:
      "Yards brews historically-inspired ales, including recipes developed in collaboration with historical consultants using 18th-century techniques.",
  },
];

export const SOUTH_PHILLY_OBJECTIVES: Objective[] = [
  {
    id: "sphl-02",
    title: "Pat's vs. Geno's Showdown",
    description:
      "Settle the great debate: order a cheesesteak from both Pat's and Geno's at the corner of 9th and Passyunk. Pick your winner.",
    hint: "They're literally across the street from each other at the intersection of 9th, Wharton, and Passyunk. Open 24/7.",
    category: "history",
    funFact:
      "Pat's King of Steaks claims to have invented the cheesesteak in 1930. Geno's opened across the street in 1966. The rivalry is eternal.",
  },
  {
    id: "sphl-04",
    title: "Mural Arts Discovery",
    description:
      "Find and photograph 3 murals in South Philly. The neighborhood is an open-air gallery.",
    hint: "Try the areas around Passyunk Ave and South Broad. The Mural Arts Philadelphia app can guide you to nearby murals.",
    category: "culture",
    funFact:
      "Philadelphia has over 4,000 murals, making it the mural capital of the world. The Mural Arts program started in 1984.",
  },
  {
    id: "sphl-05",
    title: "Rocky Steps Sprint",
    description:
      "Run up the Rocky Steps at the Philadelphia Museum of Art and raise your fists at the top. You know you have to.",
    hint: "The steps face the Ben Franklin Parkway. The Rocky statue is at the bottom-right of the steps — get a photo there too.",
    category: "entertainment",
    funFact:
      "The bronze Rocky statue was originally placed at the top of the steps as a movie prop in Rocky III, then moved to its current spot at the base.",
  },
  {
    id: "sphl-03",
    title: "Singing Fountain Moment",
    description:
      "Find the Singing Fountain at the Passyunk Avenue intersection and sit for a minute. This is the heart of East Passyunk.",
    hint: "The fountain is at the intersection where Passyunk, 13th Street, and Tasker converge. Look for the octagonal fountain.",
    category: "culture",
    funFact:
      "East Passyunk Avenue was named one of America's best food streets by Bon Appétit magazine.",
  },
  {
    id: "sphl-01",
    title: "Italian Market Immersion",
    description:
      "Walk the 9th Street Italian Market from Wharton to Christian. Buy a cannoli or fresh mozzarella from one of the shops.",
    hint: "Start at 9th and Wharton, walk north. Claudio's, DiBruno Bros, and Isgro's are highlights.",
    category: "food-beverage",
    funFact:
      "The Italian Market is the oldest continuously operating outdoor market in the United States, dating to the 1880s.",
  },
];

export const STADIUM_OBJECTIVES: Objective[] = [
  {
    id: "stad-01",
    title: "Walk of Fame",
    description:
      "Find the Philadelphia Sports Walk of Fame in the stadium complex and photograph your favorite legend's plaque.",
    hint: "The walk stretches along the walkways between Citizens Bank Park and Lincoln Financial Field.",
    category: "history",
    funFact:
      "The Walk of Fame includes plaques for legends like Wilt Chamberlain, Mike Schmidt, Reggie White, and Bobby Clarke.",
  },
  {
    id: "stad-05",
    title: "FDR Park Escape",
    description:
      "Take a walk through FDR Park — a massive green oasis next to the stadiums with trails, meadows, and a boathouse.",
    hint: "Enter from Broad St and Pattison Ave. The Meadow Loop trail is about 1.5 miles and goes past the lake.",
    category: "culture",
    funFact:
      "FDR Park was originally designed by the Olmsted Brothers (sons of Central Park's designer) for the 1926 Sesquicentennial Exposition.",
  },
  {
    id: "stad-02",
    title: "World Cup Watch Party",
    description:
      "Catch a World Cup match at Lincoln Financial Field or find an official FIFA Fan Fest watch party in the stadium district.",
    hint: "Check the official FIFA and Philadelphia World Cup host city pages for match schedules and fan fest locations.",
    category: "entertainment",
    funFact:
      "Lincoln Financial Field holds over 69,000 fans and will host group stage matches during the 2026 World Cup.",
  },
  {
    id: "stad-04",
    title: "Phillie Phanatic Hunt",
    description:
      "Spot the Phillie Phanatic — the greatest mascot in sports — at Citizens Bank Park during a game or at an All-Star Week event.",
    hint: "The Phanatic is always roaming during Phillies home games. During All-Star week, check special event schedules.",
    category: "entertainment",
    funFact:
      "The Phillie Phanatic debuted in 1978 and has been voted the best mascot in professional sports multiple times.",
  },
  {
    id: "stad-03",
    title: "Xfinity Live! Pregame",
    description:
      "Grab a drink at Xfinity Live! — Philly's massive sports entertainment complex. Soak in the game day energy.",
    hint: "1100 Pattison Ave, right in the heart of the stadium district. Multiple bars and restaurants under one roof.",
    category: "food-beverage",
    funFact:
      "Xfinity Live! spans over 80,000 square feet and includes NBC Sports Arena, PBR Philly, and Broad Street Bullies Pub.",
  },
];

// === NEW NEIGHBORHOODS ===

export const CHINATOWN_OBJECTIVES: Objective[] = [
  {
    id: "chnt-01",
    title: "Friendship Gate Guardian",
    description:
      "Stand under the Chinatown Friendship Gate on 10th and Arch and photograph the ornate arch. It's the largest authentic Chinese gate outside of China.",
    hint: "10th and Arch Streets. The gate is 40 feet tall with Chinese characters and colorful tile work. Hard to miss.",
    category: "history",
    funFact:
      "The gate was built in 1984 as a collaboration between Philadelphia and its sister city Tianjin, China. Artisans from both cities worked on it.",
  },
  {
    id: "chnt-02",
    title: "Mural Magic on 10th",
    description:
      "Find the large-scale murals along 10th Street that celebrate Asian American culture and the Chinatown community.",
    hint: "Walk 10th Street between Arch and Vine. Several buildings have full-wall murals commissioned by community organizations.",
    category: "culture",
    funFact:
      "Philadelphia's Chinatown has fought off multiple displacement threats since the 1960s, including a proposed expressway and convention center expansion.",
  },
  {
    id: "chnt-03",
    title: "Karaoke King",
    description:
      "Belt out a song at one of Chinatown's karaoke spots. Private rooms mean no judgment. Go full Main Character.",
    hint: "KTV lounges are scattered along Race and Arch Streets. Ask any local for their favorite.",
    category: "entertainment",
    funFact:
      "Philadelphia's Chinatown is one of the oldest in the US, established in the 1870s by Cantonese immigrants.",
  },
  {
    id: "chnt-04",
    title: "Bubble Tea Crawl",
    description:
      "Try bubble tea from at least 2 different shops in Chinatown. Compare flavors, toppings, and sweetness levels.",
    hint: "Kung Fu Tea, Tiger Sugar, and Tea Do are all within a few blocks. Get different flavors at each.",
    category: "food-beverage",
    funFact:
      "Philadelphia's bubble tea scene has exploded, with over 20 shops in Center City alone. Chinatown has the highest concentration.",
  },
  {
    id: "chnt-05",
    title: "Nan Zhou Noodle House Feast",
    description:
      "Get hand-pulled noodles at Nan Zhou Hand Drawn Noodle House. Watch them stretch the dough right in front of you.",
    hint: "1001 Race St. The hand-pulled noodle soup and spicy cumin lamb are the move. Cash preferred.",
    category: "food-beverage",
    funFact:
      "Nan Zhou's noodle master stretches dough into dozens of thin strands in seconds — a technique that takes years to learn.",
  },
];

export const MANAYUNK_OBJECTIVES: Objective[] = [
  {
    id: "mnyk-01",
    title: "Canal Towpath Time Machine",
    description:
      "Walk the Manayunk Canal Towpath and imagine the mule-drawn barges that once carried coal and goods along this 19th-century waterway.",
    hint: "Access the towpath from Main Street near Lock Street. The flat, paved trail runs alongside the Schuylkill River.",
    category: "history",
    funFact:
      "The Manayunk Canal was built in 1819 and powered over 100 textile mills. The name 'Manayunk' comes from the Lenape word for 'where we go to drink.'",
  },
  {
    id: "mnyk-02",
    title: "Main Street Gallery Walk",
    description:
      "Browse at least 2 independent boutiques or galleries on Main Street. Manayunk's art scene flies under the radar.",
    hint: "Main Street between Grape and Levering has the densest cluster. Look for the small galleries between the restaurants.",
    category: "culture",
    funFact:
      "Main Street Manayunk was one of the first commercial districts in the US to be added to the National Register of Historic Places.",
  },
  {
    id: "mnyk-03",
    title: "Wall Climber",
    description:
      "Tackle the Manayunk Wall — the famous steep hill on Lyceum Avenue. Walk, run, or just stare at the 17% grade in disbelief.",
    hint: "Lyceum Avenue between Main Street and Silverwood. The Wall is featured in the Philadelphia International Cycling Championship.",
    category: "entertainment",
    funFact:
      "The Manayunk Wall is a 17% grade climb that professional cyclists call one of the toughest urban climbs in America.",
  },
  {
    id: "mnyk-04",
    title: "Craft Beer Flight",
    description:
      "Get a flight at Manayunk Brewing Company — one of the oldest brewpubs in Philadelphia. The rooftop deck has river views.",
    hint: "4120 Main St. Ask about seasonal releases. The IPA and the lager are both solid starting points.",
    category: "food-beverage",
    funFact:
      "Manayunk Brewing Company opened in 1996 in a renovated 19th-century textile mill, keeping the exposed brick and industrial character.",
  },
  {
    id: "mnyk-05",
    title: "Taco Window Run",
    description:
      "Grab tacos from one of Main Street's Mexican spots. Several have walk-up windows perfect for eating while strolling.",
    hint: "Lucky's Last Chance and Taqueria Feliz are local favorites. Main Street has multiple options within walking distance.",
    category: "food-beverage",
    funFact:
      "Manayunk's restaurant scene has grown from a handful of pubs to over 30 restaurants on Main Street alone.",
  },
];

export const UNIVERSITY_CITY_OBJECTIVES: Objective[] = [
  {
    id: "ucty-01",
    title: "Penn Museum Explorer",
    description:
      "Visit the University of Pennsylvania Museum of Archaeology and Anthropology. Find the 12-ton Sphinx in the Egyptian gallery.",
    hint: "3260 South St. The museum holds over a million objects from around the world. The Egyptian and Mesopotamian galleries are highlights.",
    category: "history",
    funFact:
      "The Penn Museum's Sphinx of Ramesses II weighs 12.9 tons and is the largest sphinx in the Western Hemisphere.",
  },
  {
    id: "ucty-02",
    title: "30th Street Station Marvel",
    description:
      "Step inside 30th Street Station and look up at the 95-foot neoclassical ceiling. Find the Angel of the Resurrection sculpture.",
    hint: "30th and Market Streets. The main hall's Corinthian columns and coffered ceiling are worth a detour even if you're not catching a train.",
    category: "culture",
    funFact:
      "30th Street Station was built in 1933 and is the third-busiest Amtrak station in the US, serving over 4 million passengers a year.",
  },
  {
    id: "ucty-03",
    title: "Schuylkill Banks Boardwalk",
    description:
      "Walk the Schuylkill Banks Boardwalk — a floating path on the river. It connects University City to Center City on foot.",
    hint: "Access from the South Street Bridge or Walnut Street Bridge. The boardwalk literally floats on the river.",
    category: "entertainment",
    funFact:
      "The Schuylkill Banks Boardwalk is the longest floating boardwalk trail in the US at over 2,000 feet.",
  },
  {
    id: "ucty-04",
    title: "Food Truck Frenzy",
    description:
      "Eat from at least 2 food trucks on the Penn campus. The stretch along 33rd and Spruce has some of the best street food in the city.",
    hint: "33rd and Spruce, or 34th and Walnut. Halal trucks, Chinese, Korean, Mexican — the variety is wild. Cash is king.",
    category: "food-beverage",
    funFact:
      "Penn's food truck scene is one of the largest university food truck clusters in the US, with over 40 trucks operating daily.",
  },
  {
    id: "ucty-05",
    title: "White Dog Cafe Brunch",
    description:
      "Brunch at the White Dog Cafe — a University City institution since 1983. The farm-to-table menu changes with the seasons.",
    hint: "3420 Sansom St. The weekend brunch is legendary. Try to sit in the outdoor garden if weather permits.",
    category: "food-beverage",
    funFact:
      "The White Dog Cafe was founded by Judy Wicks, a pioneer of the local food and social enterprise movement in Philadelphia.",
  },
];

export const ULTIMATE_QUEST_IDS = [
  "ritt-04",
  "midv-05",
  "oldc-01",
  "oldc-02",
  "nlib-05",
  "sphl-05",
  "sphl-01",
  "stad-02",
  "midv-03",
  "nlib-02",
  "chnt-01",
  "ucty-01",
];
