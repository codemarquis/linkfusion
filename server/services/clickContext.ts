/**
 * Turns a request into the anonymous facts stored for a click. The IP is used
 * only for an offline country lookup (no third-party service) and is then
 * discarded; the referrer is reduced to its host name.
 */
import { createRequire } from "node:module";
import { parseUserAgent } from "./userAgent";

const require = createRequire(import.meta.url);
const geoip: { lookup(ip: string): { country: string } | null } = require("geoip-country");

export type ClickFacts = {
  country: string | null;
  device: string;
  browser: string;
  os: string;
  referrerHost: string | null;
};

export function countryForIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const clean = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  try {
    const country = geoip.lookup(clean)?.country;
    return country && /^[A-Z]{2}$/.test(country) ? country : null;
  } catch {
    return null;
  }
}

export function referrerHost(referrer: string | undefined, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().slice(0, 255);
    return host && host !== ownHost ? host : null;
  } catch {
    return null;
  }
}

export function clickFacts(input: { ip?: string; userAgent?: string; referrer?: string; ownHost: string }): ClickFacts {
  return {
    country: countryForIp(input.ip),
    ...parseUserAgent(input.userAgent),
    referrerHost: referrerHost(input.referrer, input.ownHost),
  };
}
