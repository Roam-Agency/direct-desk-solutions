/**
 * Trust bullets — three short statements answering "but is this really
 * good?" before the buyer asks. Three bullets so the eye can land on
 * one quickly without scanning a list.
 *
 * Content strategy:
 *   - Bullet 1 (Provenance): derives from product.source when it
 *     exists ("Sourced from: Corporate clear-out, EC2"), else
 *     "Direct from corporate clear-outs".
 *   - Bullet 2 (Refurb): always "Refurbished in our UK workshop" —
 *     this is the brand's headline trust claim, not product-specific.
 *   - Bullet 3 (Warranty): "3-month warranty included". These bullets
 *     render for USED items only (see the product page's condition gate),
 *     and the store's policy is 3-month on refurbished / 12-month on new —
 *     so the used-only bullet must say 3, not 12.
 *
 * Future iterations could pull refurb_date or refurb-location into
 * the workshop bullet, but for v1 the static copy is stronger
 * because it makes the same promise on every product.
 *
 * Renders for used items only. New items don't need this trust
 * scaffolding to the same degree.
 */

type TrustBulletsProps = {
  source: string | null;
};

const BULLETS = [
  { label: "Workshop", body: "Refurbished in our UK workshop" },
  { label: "Warranty", body: "3-month warranty included" },
] as const;

export default function TrustBullets({ source }: TrustBulletsProps) {
  const provenanceBody = source
    ? `Sourced from ${source}`
    : "Direct from corporate clear-outs";

  return (
    <ul className="divide-y divide-rule border-y border-rule">
      <li className="py-4 flex flex-col gap-1">
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-red">
          Provenance
        </p>
        <p className="text-sm text-ink leading-snug">{provenanceBody}</p>
      </li>
      {BULLETS.map((b) => (
        <li key={b.label} className="py-4 flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-red">
            {b.label}
          </p>
          <p className="text-sm text-ink leading-snug">{b.body}</p>
        </li>
      ))}
    </ul>
  );
}
