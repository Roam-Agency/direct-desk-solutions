/**
 * Direct Desk Solutions brand logo (arrow + wordmark).
 *
 * Renders the real brand artwork as an optimised image. Two variants are
 * provided so the wordmark stays legible on any surface:
 *   - "dark"  → red arrow + near-black wordmark, for light backgrounds
 *               (public header).
 *   - "light" → red arrow + white wordmark, for dark backgrounds
 *               (footer, mobile menu).
 *
 * Size is controlled by the caller via `className` (set a height and keep
 * `w-auto` so the intrinsic aspect ratio is preserved). The header uses
 * responsive height utilities; the footer/menu use a fixed height.
 */
import Image from "next/image";
import logoDark from "@/assets/brand/dds-logo-dark.png";
import logoLight from "@/assets/brand/dds-logo-light.png";

type LogoProps = {
  variant?: "light" | "dark";
  className?: string;
  /** Preload the image (use for the above-the-fold header logo). */
  preload?: boolean;
};

export default function Logo({
  variant = "dark",
  className = "",
  preload = false,
}: LogoProps) {
  const src = variant === "light" ? logoLight : logoDark;

  return (
    <Image
      src={src}
      alt="Direct Desk Solutions"
      // Intrinsic width/height come from the static import; `className`
      // sets the display height with `w-auto` to keep the aspect ratio.
      className={className}
      preload={preload}
      sizes="(min-width: 1024px) 200px, 160px"
    />
  );
}
