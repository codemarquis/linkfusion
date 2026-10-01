/** Coarse user-agent classification. Order matters: Edge/Opera contain "Chrome", iPadOS/iOS contain "Mac". */
export type ParsedAgent = { device: "mobile" | "tablet" | "desktop" | "bot"; browser: string; os: string };

export function parseUserAgent(raw: string | undefined): ParsedAgent {
  const ua = (raw ?? "").slice(0, 512);
  const lower = ua.toLowerCase();

  let device: ParsedAgent["device"] = "desktop";
  if (/bot|crawler|spider|slurp|facebookexternalhit|preview/.test(lower)) device = "bot";
  else if (/ipad|tablet|(android(?!.*mobile))/.test(lower)) device = "tablet";
  else if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(lower)) device = "mobile";

  let browser = "Other";
  if (/edg\//.test(lower)) browser = "Edge";
  else if (/opr\/|opera/.test(lower)) browser = "Opera";
  else if (/samsungbrowser/.test(lower)) browser = "Samsung Internet";
  else if (/firefox|fxios/.test(lower)) browser = "Firefox";
  else if (/chrome|crios|chromium/.test(lower)) browser = "Chrome";
  else if (/safari/.test(lower)) browser = "Safari";

  let os = "Other";
  if (/iphone|ipad|ipod/.test(lower)) os = "iOS";
  else if (/android/.test(lower)) os = "Android";
  else if (/windows/.test(lower)) os = "Windows";
  else if (/mac os x|macintosh/.test(lower)) os = "macOS";
  else if (/cros/.test(lower)) os = "ChromeOS";
  else if (/linux/.test(lower)) os = "Linux";

  return { device, browser, os };
}
