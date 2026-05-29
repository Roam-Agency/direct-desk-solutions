import Link from "next/link";
import Logo from "./_Logo";
import { getAppSettings } from "@/lib/settings/fetch";

export default async function PublicFooter() {
  const settings = await getAppSettings();
  const contactEmail = settings.contact_email;
  const freeDeliveryMessage = settings.free_delivery_message.trim();

  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between sm:gap-12">
          {/* Logo + tagline */}
          <div className="sm:max-w-xs">
            <Logo variant="light" className="h-7 w-auto" />
            <p className="mt-4 text-sm leading-relaxed text-stone-400">
              Quality office furniture, new and refurbished — honestly
              described and delivered UK-wide from our Darlington
              workshop.
            </p>
            {freeDeliveryMessage && (
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-brand-red">
                {freeDeliveryMessage}
              </p>
            )}
          </div>

          {/* Why DDS link column — surfaces the three trust pages
              site-wide without cluttering the homepage trust trio. */}
          <nav aria-label="Why DDS" className="flex flex-col gap-3">
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-stone-500 mb-1">
              Why DDS
            </p>
            <Link
              href="/about"
              className="text-xs uppercase tracking-[0.18em] font-bold text-white hover:text-brand-red transition-colors"
            >
              About
            </Link>
            <Link
              href="/why-used"
              className="text-xs uppercase tracking-[0.18em] font-bold text-white hover:text-brand-red transition-colors"
            >
              Why used?
            </Link>
            <Link
              href="/how-we-refurbish"
              className="text-xs uppercase tracking-[0.18em] font-bold text-white hover:text-brand-red transition-colors"
            >
              How we refurbish
            </Link>
          </nav>

          {/* Contact */}
          <div className="flex flex-col gap-3 text-xs uppercase tracking-[0.18em] sm:items-end">
            <a
              href={`mailto:${contactEmail}`}
              className="font-bold border-b-2 border-white pb-1 hover:opacity-70 transition-opacity self-start sm:self-auto"
            >
              {contactEmail}
            </a>
            <p className="text-[10px] tracking-[0.2em] text-stone-600">
              © 2026 Direct Desk Solutions Ltd
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
