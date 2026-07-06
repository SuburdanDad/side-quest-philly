/** Coarse device classification from a user-agent string. */
export function classifyDevice(
  ua: string | null,
): "mobile" | "tablet" | "desktop" | null {
  if (!ua) return null;
  const s = ua.toLowerCase();
  if (/ipad|tablet|silk/.test(s)) return "tablet";
  if (/android(?!.*mobile)/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android/.test(s)) return "mobile";
  if (/mozilla|windows|macintosh|linux|x11/.test(s)) return "desktop";
  return null;
}
