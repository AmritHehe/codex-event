// Research brief: what Shipcast knows about a product, every claim tied to the page that states it.
// Shared by POST /api/research, /api/generate (optional `research` field), /api/kit and the MCP tool research_product.
import { z } from "zod";

const source = z.string().url().describe("URL of the page that states this.");
const line = z.string().min(1).max(300);

export const researchRequest = z.object({ url: z.string().url() });

export const researchBrief = z.object({
  url: z.string().url(),
  researchedAt: z.string().datetime(),
  product: z.object({
    name: z.string().min(1).max(80),
    oneLiner: line,
    category: z.string().max(80),
    audience: line,
    problem: line,
    sourceUrl: source,
  }),
  features: z.array(z.object({ name: z.string().min(1).max(80), benefit: line, sourceUrl: source })).max(8),
  /** Only facts a source states verbatim: metrics, customer quotes, awards, notable customers. */
  proof: z.array(z.object({ kind: z.enum(["metric", "quote", "award", "customer"]), text: line, sourceUrl: source })).max(6),
  competitors: z.array(z.object({ name: z.string().min(1).max(80), url: z.string().url(), howDifferent: line })).max(5),
  mentions: z.array(z.object({ title: z.string().max(200), url: z.string().url(), source: z.string().max(100), highlight: z.string().max(600), publishedDate: z.string().optional() })).max(8),
  voice: z.object({
    adjectives: z.array(z.string().max(30)).max(5),
    sampleLines: z.array(z.object({ text: line, sourceUrl: source })).max(5).describe("Lines quoted word for word from the product's own pages."),
  }),
  visuals: z.array(z.object({ url: z.string().url(), kind: z.enum(["og", "screenshot", "logo"]) })).max(8),
  sources: z.array(z.object({ url: z.string().url(), title: z.string().max(200) })).max(30),
});

export type ResearchBrief = z.infer<typeof researchBrief>;
