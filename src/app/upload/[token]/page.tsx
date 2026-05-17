import { resolveUploadToken } from "@/app/admin/(authed)/products/_actions";
import { MobileUploader } from "./_MobileUploader";

/**
 * Mobile upload page. Reached by scanning the QR code that the desktop
 * edit view generates. Deliberately NOT under /admin — the page is
 * unauthenticated by design, because whatever phone is scanning the QR
 * may not be signed in.
 *
 * The route param is the only credential. We resolve it server-side here
 * and only render the uploader if the token is valid. Invalid tokens
 * render a friendly stub explaining what went wrong, with specific copy
 * for expired / revoked / exhausted / not_found so the admin knows
 * whether to mint a new one or check the original.
 *
 * No layout, no header, no admin chrome. The phone screen is small and
 * the user is in upload-mode only — we strip everything that doesn't
 * help them get a photo into the catalog.
 */
export default async function MobileUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolution = await resolveUploadToken(token);

  if (!resolution.ok) {
    return <UploadLinkProblem reason={resolution.reason} />;
  }

  return (
    <MobileUploader
      token={token}
      productName={resolution.productName}
      productSku={resolution.productSku}
      expiresAt={resolution.expiresAt}
    />
  );
}

function UploadLinkProblem({
  reason,
}: {
  reason: "expired" | "revoked" | "exhausted" | "not_found";
}) {
  const headline = {
    expired: "This link has expired",
    revoked: "This link has been revoked",
    exhausted: "This link has reached its upload limit",
    not_found: "This link is not valid",
  }[reason];

  const body = {
    expired:
      "Upload links last 15 minutes. Ask the person on the desktop to send a fresh one.",
    revoked:
      "This link was cancelled before you opened it. Ask for a new one if you still need to upload.",
    exhausted:
      "This link has been used many times already. Ask for a new one to keep uploading.",
    not_found:
      "We couldn\u2019t find this link. Check that you scanned the whole QR code, or ask for a new link.",
  }[reason];

  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-6 py-10">
      <div className="max-w-sm text-center">
        <p className="text-xs uppercase tracking-widest text-ink/60 mb-3">
          Direct Desk Solutions
        </p>
        <h1 className="text-2xl font-black mb-4">{headline}</h1>
        <p className="text-sm leading-relaxed text-ink/70">{body}</p>
      </div>
    </main>
  );
}
