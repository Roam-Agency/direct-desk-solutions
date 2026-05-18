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
 */
export interface AiSuggestion {
  alt: string;
  tags: string[];
  category_ids: string[];
  condition_observations: string[];
  model: string;
  suggested_at: string;
}
