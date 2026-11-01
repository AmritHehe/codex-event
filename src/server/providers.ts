import { structured } from "./ai";
import { scrapeProduct } from "./scrape";

// Injectable boundary lets tests exercise real services without paid provider calls.
export const providers = { structured, scrapeProduct };
export type Providers = typeof providers;
