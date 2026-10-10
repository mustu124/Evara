/** Listing options shared by server queries and the client filter bar. */
export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export const AVAILABILITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "available", label: "Available now" },
  { value: "coming-soon", label: "Coming soon" },
] as const;
export type AvailabilityKey = (typeof AVAILABILITY_OPTIONS)[number]["value"];
