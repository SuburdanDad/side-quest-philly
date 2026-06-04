export type ObjectiveCategory =
  | "culture"
  | "history"
  | "entertainment"
  | "food-beverage";

export type Objective = {
  id: string;
  title: string;
  description: string;
  hint: string;
  category: ObjectiveCategory;
  funFact?: string;
};

export type Neighborhood = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  color: string;
  objectives: Objective[];
};

export type PhillyEvent = {
  id: string;
  name: string;
  venue: string;
  dateRange: string;
  description: string;
  emoji: string;
};

export type QuestProgress = {
  completedObjectives: string[];
  completedNeighborhoods: string[];
  ultimateCompleted: boolean;
  firstVisit: string;
  lastActivity: string;
};

export const CATEGORY_CONFIG: Record<
  ObjectiveCategory,
  { label: string; color: string }
> = {
  culture: { label: "Culture", color: "bg-violet-100 text-violet-700" },
  history: { label: "History", color: "bg-amber-100 text-amber-700" },
  entertainment: {
    label: "Entertainment",
    color: "bg-cyan-100 text-cyan-700",
  },
  "food-beverage": {
    label: "Food & Drink",
    color: "bg-red-100 text-red-700",
  },
};
