"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { createUploadToken } from "./_actions";

/**
 * Modal that mints a fresh upload token, renders a QR code for the
 * mobile uploader URL, and counts down the 15-min expiry.
 *
 * Opened from the desktop ImageUploader via the "Send to phone" button.
 * Closes on overlay click, Escape, or the explicit close button.
 *
 * The token is minted on mount, not on button-click in the parent —
 * keeps the parent component dumb (it just toggles open state) and
 * lets us guarantee the token shown is fresh every time the modal
 * is opened.
 *
 * QR rendering: qrcode.toString(url, { type: "svg" }) produces an
 * SVG string we inject via dangerouslySetInnerHTML. Cleaner than the
 * canvas API (no ref + useEffect dance, no SSR hydration concerns)
 * and SVG scales naturally on retina displays.
 */

type TokenState =
  | { status: "loading" }
  | { status: "ready"; token: string; expiresAt: string; svg: string }
  | { status: "error"; message: string };

export function SendToPhoneModal({
  productId,
  productName,
  onClose,
}: {
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const [tokenState, setTokenState] = useState<TokenState>({ status: "loading" });
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  // Mint a token on mount, also exposed as a callback for "Generate new link".
  const mintToken = useCallback(async () => {
    setTokenState({ status: "loading" });
    setCopied(false);

    const result = await createUploadToken(productId);
    if (!result.ok) {
      setTokenState({ status: "error", message: result.formError });
      return;
    }

    const url = `${window.location.origin}/upload/${result.token}`;
    try {
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        width: 240,
        color: {
          // QR foreground is ink, background transparent so the surrounding
          // panel colour shows through.
          dark: "#0A0A0A",
          light: "#0000",
        },
      });
      setTokenState({
        status: "ready",
        token: result.token,
        expiresAt: result.expiresAt,
        svg,
      });
    } catch (err) {
      setTokenState({
        status: "error",
        message: err instanceof Error ? err.message : "QR render failed",
      });
    }
  }, [productId]);

  useEffect(() => {
    mintToken();
  }, [mintToken]);

  // Tick the countdown every 30s. Cheap, doesn't need to be precise.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Compute the URL up front for the copy button — only meaningful in "ready".
  const url =
    tokenState.status === "ready"
      ? `${window.location.origin}/upload/${tokenState.token}`
      : "";

  const minutesRemaining =
    tokenState.status === "ready"
      ? Math.max(
          0,
          Math.floor((new Date(tokenState.expiresAt).getTime() - now) / 60_000)
        )
      : 0;

  const expired = tokenState.status === "ready" && minutesRemaining === 0;

  const handleCopy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers / non-secure contexts: noop, the link is still
      // visible in the UI for manual copy.
    }
  }, [url]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-paper border border-ink/10 max-w-md w-full p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-ink/60 hover:text-ink transition-colors"
        >
          ×
        </button>

        <p className="text-[10px] uppercase tracking-widest text-ink/60 mb-1">
          Send to phone
        </p>
        <h2 className="text-lg font-black leading-tight mb-1">{productName}</h2>
        <p className="text-xs text-ink/60 mb-6">
          Scan with the phone you want to upload from. The link is good for 15 minutes.
        </p>

        {tokenState.status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-60 h-60 border border-dashed border-rule flex items-center justify-center text-[10px] uppercase tracking-widest text-ink/40">
              Generating link
            </div>
          </div>
        )}

        {tokenState.status === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-brand-red text-center">
              {tokenState.message}
            </p>
            <button
              type="button"
              onClick={mintToken}
              className="text-[11px] uppercase tracking-widest border border-ink px-4 py-2 hover:bg-ink hover:text-paper transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {tokenState.status === "ready" && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-60 h-60 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: tokenState.svg }}
            />

            <p
              className={
                expired
                  ? "text-[11px] uppercase tracking-widest text-brand-red"
                  : "text-[11px] uppercase tracking-widest text-ink/50"
              }
            >
              {expired
                ? "Link expired"
                : `Expires in ~${minutesRemaining} min`}
            </p>

            {expired ? (
              <button
                type="button"
                onClick={mintToken}
                className="text-[11px] uppercase tracking-widest bg-ink text-paper px-4 py-2 hover:bg-brand-red transition-colors"
              >
                Generate new link
              </button>
            ) : (
              <div className="w-full mt-2">
                <p className="text-[10px] uppercase tracking-widest text-ink/40 mb-1">
                  Or copy the link
                </p>
                <div className="flex border border-rule">
                  <input
                    type="text"
                    readOnly
                    value={url}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 px-3 py-2 text-[11px] font-mono bg-paper text-ink/70 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-2 text-[10px] uppercase tracking-widest border-l border-rule hover:bg-ink hover:text-paper transition-colors"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
