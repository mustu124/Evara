"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { imageUrl } from "@/lib/format";
import type { HomepageSettings } from "@/lib/types";

const INTERVAL_MS = 6000;
const arrow =
  "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-cocoa/35 text-ivory backdrop-blur-sm transition-colors hover:bg-cocoa/60 sm:flex";

/** Full-width banner slideshow with the headline and Shop Now button over the photo. */
export function Hero({ hero }: { hero: HomepageSettings["hero"] }) {
  const slides = hero.slides.map((s) => ({ ...s, src: imageUrl(s.image_path) })).filter((s) => s.src);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const many = slides.length > 1;

  useEffect(() => {
    if (!many || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [many, paused, slides.length]);

  const go = (delta: number) => setIndex((i) => (i + delta + slides.length) % slides.length);

  return (
    <section
      className="relative h-[calc(100svh-4.5rem)] max-h-[54rem] min-h-[30rem] w-full overflow-hidden bg-blush"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription={many ? "carousel" : undefined}
      aria-label="Evara Studios"
    >
      {slides.map((slide, i) => (
        <Image
          key={slide.image_path}
          src={slide.src!}
          alt={slide.alt || "Evara Studios candles"}
          fill
          priority={i === 0}
          loading={i === 0 ? undefined : "lazy"}
          sizes="100vw"
          aria-hidden={i !== index}
          className={`object-cover transition-opacity duration-1000 ease-in-out ${i === index ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      {/* Darkens the lower part of the photo so the white text stays readable. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/10" />

      {many && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous image" className={`${arrow} left-5`}>
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next image" className={`${arrow} right-5`}>
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-5 pb-8 text-center sm:pb-10">
        <div className="animate-fade-up">
          {hero.eyebrow && (
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.32em] text-ivory/90 sm:text-xs">{hero.eyebrow}</p>
          )}
          <h1 className="mt-3 text-5xl italic leading-[1.05] !text-ivory drop-shadow-sm sm:text-6xl lg:text-7xl">{hero.heading}</h1>
          <Link href={hero.cta_href} className="btn-primary mt-7">
            {hero.cta_label} <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>

        {many && (
          <div className="mt-5 flex items-center gap-1">
            {slides.map((slide, i) => (
              <button
                key={slide.image_path}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1} of ${slides.length}`}
                aria-current={i === index}
                className="flex h-9 items-center px-1"
              >
                <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-7 bg-copper" : "w-1.5 bg-ivory/70"}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
