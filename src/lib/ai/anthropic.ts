import Anthropic from "@anthropic-ai/sdk";

/**
 * Singleton Anthropic client. Lazily instantiated on first use so that
 * importing this module at build time doesn't crash when ANTHROPIC_API_KEY
 * isn't in the build environment (e.g. during static analysis).
 */
let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Add it to .env.local for local dev and to Netlify env vars for production."
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * The vision model we use for product-image analysis. Sonnet 4.6 gives
 * sharp brand/model recognition (matters for the used catalogue) at
 * cents-per-image cost. See:
 * https://docs.claude.com/en/docs/about-claude/models/overview
 */
export const VISION_MODEL = "claude-sonnet-4-6";

/**
 * Structured suggestion shape — what we store in product_images.ai_suggestions
 * and what the UI accept/reject buttons read from.
 *
 * The four drafted-from-photo fields (name, description, brand,
 * condition_grade) are OPTIONAL so suggestions stored before Branch 1
 * (which lack them) still satisfy the type. They are populated by
 * Claude when the photo affords confident inference; otherwise the
 * model returns null and the admin types the field themselves.
 *
 * Branch 2 (UI) reads these to populate the "Apply AI draft to product
 * details" block on the hero image's suggestion strip.
 */
export interface AiSuggestion {
  // Enrichment (existing — populated for every image)
  alt: string;
  tags: string[];
  category_ids: string[];
  condition_observations: string[];
  // Drafted-from-photo (Branch 1 — populated when the model is confident,
  // null otherwise; absent on suggestions stored before Branch 1)
  name?: string | null;
  description?: string | null;
  brand?: string | null;
  condition_grade?: "A" | "B" | "C" | null;
  // Provenance (existing — stamped server-side)
  model: string;
  suggested_at: string;
}
