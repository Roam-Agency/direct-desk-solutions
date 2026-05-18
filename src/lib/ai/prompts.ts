/**
 * Prompt construction for the AI image-analysis pipeline.
 *
 * Kept separate from the action so we can iterate on prompt design without
 * touching the surrounding code. If we ever want to swap to a different
 * cataloguer voice (e.g. for a different client) it's a single-file change.
 */

export interface CategoryForPrompt {
  id: string;
  name: string;
  kind: "functional" | "brand" | "merchandising";
}

export interface ProductContextForPrompt {
  name: string;
  brand: string | null;
  condition: "new" | "used";
  condition_grade: "A" | "B" | "C" | null;
  description: string | null;
}

export const SYSTEM_PROMPT = `You are a product cataloguer for Direct Desk Solutions, a UK office furniture retailer. You analyse product photos and return structured metadata used to populate a catalogue.

Your job:
1. Generate accurate, descriptive alt text (one sentence, factual, accessibility-focused — describe what is visually present, not marketing language).
2. Suggest 5 to 10 lowercase keyword tags useful for product search (e.g. "mesh", "ergonomic", "graphite", "size-b").
3. Suggest which provided categories the product belongs to, by category UUID.
4. For used items only: note specific visible wear, scuffs, marks, or imperfections you can see in the image.

CRITICAL RULES:
- Return STRICT JSON, no markdown fences, no prose before or after.
- The schema is exactly:
  {
    "alt": "string",
    "tags": ["string", ...],
    "category_ids": ["uuid", ...],
    "condition_observations": ["string", ...]
  }
- category_ids MUST be UUIDs taken directly from the provided category list. Do not invent UUIDs.
- condition_observations is an empty array [] for new items. For used items, only describe what is genuinely visible in the photo — do not speculate or repeat the seller's written notes.
- Tags are lowercase, hyphen-separated where multi-word (e.g. "herman-miller", "task-chair").
- Alt text is one sentence, 8-20 words. No "Image of..." prefix; describe directly.`;

export function buildUserPrompt(
  product: ProductContextForPrompt,
  categories: CategoryForPrompt[]
): string {
  const categoryList = categories
    .map((c) => `  - ${c.id} (${c.kind}): ${c.name}`)
    .join("\n");

  const conditionLine =
    product.condition === "used"
      ? `Condition: USED${product.condition_grade ? ` (grade ${product.condition_grade})` : ""}`
      : "Condition: NEW";

  return `Analyse the attached product photo and return JSON metadata.

Product context (use to inform but do not blindly trust — analyse what you actually see):
  Name: ${product.name}
  Brand: ${product.brand ?? "(none declared)"}
  ${conditionLine}
  ${product.description ? `Description: ${product.description}` : ""}

Available categories (use these UUIDs in category_ids; pick the most relevant — usually 2 to 4):
${categoryList}

Remember: strict JSON only.`;
}
