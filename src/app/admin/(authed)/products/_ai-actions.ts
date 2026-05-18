"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import {
  getAnthropicClient,
  VISION_MODEL,
  type AiSuggestion,
} from "@/lib/ai/anthropic";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  type CategoryForPrompt,
  type ProductContextForPrompt,
} from "@/lib/ai/prompts";

/**
 * Server Actions for AI-powered image metadata suggestion.
 *
 * suggestImageMetadata(imageId) calls Claude vision with the Cloudinary
 * image URL and product context, parses the response, filters category_ids
 * to existing UUIDs, and writes the full payload to
 * product_images.ai_suggestions. It does NOT auto-apply — the admin
 * accepts or rejects via the UI (patch 3d).
 *
 * The action is callable from both the auto-trigger after attachImage
 * (patch 3c) and the manual "Re-suggest" button (patch 3d).
 *
 * Return shape:
 *   { ok: true, suggestion: AiSuggestion }
 *   { ok: false, formError: string }
 */

type ActionResult =
  | { ok: true; suggestion: AiSuggestion }
  | { ok: false; formError: string };

/**
 * The raw shape we expect back from Claude — narrower than AiSuggestion
 * because model + suggested_at are stamped server-side, not asked for.
 */
const claudeResponseSchema = z.object({
  alt: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(50)).max(20),
  category_ids: z.array(z.string().uuid()).max(20),
  condition_observations: z.array(z.string().min(1).max(300)).max(20),
});

export async function suggestImageMetadata(
  imageId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  // 1. Fetch image + product + active categories in parallel.
  const [imageResult, categoriesResult] = await Promise.all([
    supabase
      .from("product_images")
      .select("id, cloudinary_url, product_id, products(name, brand, condition, condition_grade, description)")
      .eq("id", imageId)
      .single(),
    supabase
      .from("categories")
      .select("id, name, kind")
      .eq("is_active", true),
  ]);

  if (imageResult.error || !imageResult.data) {
    return { ok: false, formError: "Image not found" };
  }
  if (categoriesResult.error) {
    return { ok: false, formError: categoriesResult.error.message };
  }

  const image = imageResult.data;
  const product = Array.isArray(image.products) ? image.products[0] : image.products;
  if (!product) {
    return { ok: false, formError: "Product not found for this image" };
  }

  const categories: CategoryForPrompt[] = (categoriesResult.data ?? []).map(
    (c) => ({ id: c.id, name: c.name, kind: c.kind })
  );

  const validCategoryIds = new Set(categories.map((c) => c.id));

  const productContext: ProductContextForPrompt = {
    name: product.name,
    brand: product.brand,
    condition: product.condition,
    condition_grade: product.condition_grade,
    description: product.description,
  };

  // 2. Call Claude.
  let rawText: string;
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: image.cloudinary_url,
              },
            },
            {
              type: "text",
              text: buildUserPrompt(productContext, categories),
            },
          ],
        },
      ],
    });

    const firstBlock = response.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      return { ok: false, formError: "Unexpected response shape from Claude" };
    }
    rawText = firstBlock.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, formError: `Claude call failed: ${message}` };
  }

  // 3. Parse JSON defensively. Claude sometimes wraps in code fences despite
  // the prompt — strip them if present.
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: z.infer<typeof claudeResponseSchema>;
  try {
    const json = JSON.parse(cleaned);
    parsed = claudeResponseSchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      formError: `Could not parse Claude response: ${message}`,
    };
  }

  // 4. Filter category_ids to ones that actually exist (Claude can hallucinate).
  const validCategoryIdsFromClaude = parsed.category_ids.filter((id) =>
    validCategoryIds.has(id)
  );

  // 5. Build the suggestion record and write it back.
  const suggestion: AiSuggestion = {
    alt: parsed.alt,
    tags: parsed.tags,
    category_ids: validCategoryIdsFromClaude,
    condition_observations: parsed.condition_observations,
    model: VISION_MODEL,
    suggested_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("product_images")
    .update({
      // AiSuggestion is structurally JSON-compatible but TS wants an explicit
      // cast through Json's index-signature shape.
      ai_suggestions: suggestion as unknown as Json,
      ai_suggested_at: suggestion.suggested_at,
    })
    .eq("id", imageId);

  if (updateError) {
    return { ok: false, formError: updateError.message };
  }

  revalidatePath(`/admin/products/${image.product_id}`);
  return { ok: true, suggestion };
}
