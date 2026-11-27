/**
 * One source for the security headers, applied by Hono to API and locally
 * served pages and written into the Vercel routing config for static files.
 * Every upstream call happens on the server, so the page needs nothing but
 * its own origin.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // No string reaches a script sink unless the page's one policy vouches for it
  // (web/src/lib/trusted.ts), and no other policy may be created.
  "require-trusted-types-for 'script'",
  "trusted-types breathprint",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Location finds the household's place and the microphone takes a spoken
 * question; the clipboard copies an advisory. Every other powerful feature is
 * off, for this page and anything it could ever embed. Photos come through the
 * file picker, which needs no camera grant.
 */
const PERMISSIONS_POLICY = [
  "geolocation=(self)",
  "microphone=(self)",
  "camera=()",
  "accelerometer=()",
  "autoplay=()",
  "bluetooth=()",
  "browsing-topics=()",
  "display-capture=()",
  "encrypted-media=()",
  "gyroscope=()",
  "hid=()",
  "idle-detection=()",
  "local-fonts=()",
  "magnetometer=()",
  "midi=()",
  "otp-credentials=()",
  "payment=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

/** The headers every response carries; the only place they are set. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": PERMISSIONS_POLICY,
  // Isolated from every other origin: nothing cross-origin loads, and nothing may embed or open it.
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-DNS-Prefetch-Control": "off",
};

/** Hashed build assets never change, so browsers and the CDN may keep them for a year. */
export const IMMUTABLE = "public, max-age=31536000, immutable";
