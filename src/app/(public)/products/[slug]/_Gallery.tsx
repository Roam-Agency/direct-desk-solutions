"use client";

/**
 * Gallery — horizontal scroll-snap carousel for product images.
 *
 * Mobile-first interaction: swipe between images, each fills the square
 * viewport. IntersectionObserver tracks which slide is active, updating
 * the pills and N/M counter. The USED·GRADE B corner tab is anchored to
 * the gallery (not individual slides), so it stays put across swipes.
 *
 * Per-slide pinch-zoom via `touch-action: pinch-zoom` — iOS Safari and
 * Android Chrome both honour this for two-finger gestures without
 * affecting the page scroll. Desktop has no touch surface so it's
 * effectively a no-op there (desktop users will hover, eventually).
 *
 * SSR fallback: the first image renders inline with no pills. No
 * hydration mismatch since the active-slide state initialises to 0.
 *
 * Edge cases:
 *   - Zero images → "No image" placeholder, corner tab still shown
 *   - One image → static render, no pills, no counter
 *   - Many images → first gets priority, rest lazy
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ConditionBadge from "./_ConditionBadge";
import type { Database } from "@/types/database";

type ProductImage = Database["public"]["Tables"]["product_images"]["Row"];
type Condition = Database["public"]["Enums"]["product_condition"];
type Grade = Database["public"]["Enums"]["product_grade"];

interface GalleryProps {
  images: ProductImage[];
  condition: Condition;
  grade: Grade | null;
  productName: string;
}

export function Gallery({
  images,
  condition,
  grade,
  productName,
}: GalleryProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const count = images.length;
  const hasMany = count > 1;

  // Track which slide is in view using IntersectionObserver.
  // We mark the slide with the highest intersection ratio as active.
  useEffect(() => {
    if (!hasMany) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const slides = scroller.querySelectorAll<HTMLElement>("[data-slide]");
    if (slides.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the highest intersection ratio that's
        // currently intersecting. This handles the case where two slides
        // are partially visible during a swipe and we want the dominant one.
        let bestRatio = 0;
        let bestIndex = activeIndex;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.slideIndex,
            );
            if (!Number.isNaN(idx)) {
              bestRatio = entry.intersectionRatio;
              bestIndex = idx;
            }
          }
        });
        if (bestRatio > 0.5) {
          setActiveIndex(bestIndex);
        }
      },
      {
        root: scroller,
        threshold: [0.25, 0.5, 0.75, 1.0],
      },
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
    // activeIndex intentionally omitted — including it would re-create the
    // observer on every change, which churns slide visibility tracking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMany, count]);

  // Empty state: no images at all
  if (count === 0) {
    return (
      <div className="relative mt-6 aspect-square w-full overflow-hidden bg-rule">
        <div className="flex h-full w-full items-center justify-center text-sm tracking-wide uppercase text-ink/40">
          No image
        </div>
        <CornerTab condition={condition} grade={grade} />
      </div>
    );
  }

  return (
    <div className="relative mt-6 w-full">
      <div
        ref={scrollerRef}
        className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden bg-rule motion-reduce:scroll-auto"
        style={{ scrollBehavior: "smooth", scrollbarWidth: "none" }}
        aria-roledescription="carousel"
        aria-label={`Images of ${productName}`}
      >
        {images.map((image, idx) => (
          <div
            key={image.id}
            data-slide
            data-slide-index={idx}
            className="relative flex aspect-square w-full shrink-0 snap-center snap-always items-center justify-center"
            style={{ touchAction: "pinch-zoom" }}
            aria-roledescription="slide"
            aria-label={`${idx + 1} of ${count}`}
          >
            <Image
              src={image.cloudinary_url}
              alt={image.alt_text || `${productName} — image ${idx + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              priority={idx === 0}
              loading={idx === 0 ? undefined : "lazy"}
              className="object-contain"
            />
          </div>
        ))}
      </div>

      <CornerTab condition={condition} grade={grade} />

      {hasMany && (
        <>
          {/* N / M counter, top-right */}
          <div className="absolute top-3 right-3 rounded-sm bg-ink/80 px-2 py-1 text-xs font-medium tracking-wide tabular-nums text-paper backdrop-blur-sm">
            {activeIndex + 1} / {count}
          </div>

          {/* Progress pills, bottom-centre */}
          <div
            className="absolute right-0 bottom-3 left-0 flex justify-center gap-1.5"
            aria-hidden="true"
          >
            {images.map((image, idx) => (
              <span
                key={image.id}
                className={`h-1.5 rounded-full transition-all duration-200 motion-reduce:transition-none ${
                  idx === activeIndex
                    ? "w-6 bg-ink"
                    : "w-1.5 bg-ink/30"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CornerTab({
  condition,
  grade,
}: {
  condition: Condition;
  grade: Grade | null;
}) {
  return (
    <div className="absolute top-0 left-0 z-10">
      <ConditionBadge condition={condition} grade={grade} size="md" />
    </div>
  );
}
