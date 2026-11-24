import { isAllowedCountry, pageForPath } from "./markets";

/** Old URLs from the multi-country site; kept so existing links keep working. */
const LEGACY_PATHS: Record<string, string> = { "/sa": "/", "/sa/en": "/", "/en": "/" };

/** Lowercase, no trailing slash ("/SA/" → "/sa"), and legacy paths mapped to their new home. */
export function normalizePath(pathname: string): string {
  let p = pathname.toLowerCase();
  if (p.length > 1) p = p.replace(/\/+$/, "") || "/";
  return LEGACY_PATHS[p] ?? p;
}

/** True for the landing page (and its aliases), the only paths geo and rate limits apply to. */
export function isPagePath(pathname: string): boolean {
  return pageForPath(normalizePath(pathname)) !== undefined;
}

export type GeoDecision =
  { action: "serve" } | { action: "redirect"; to: string } | { action: "block" };

/**
 * What to do with a visitor from `country` opening the landing page at `pathname`: only Saudi
 * visitors are served; aliases (e.g. the old `/sa`) are redirected to the canonical path first.
 */
export function geoDecision(pathname: string, country: string | null | undefined): GeoDecision {
  if (!isAllowedCountry(country)) return { action: "block" };
  const target = normalizePath(pathname);
  return target === pathname ? { action: "serve" } : { action: "redirect", to: target };
}
