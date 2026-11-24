import { pageForPath } from "./markets";

/** Old URLs from the multi-country site; kept so existing links keep working. */
const LEGACY_PATHS: Record<string, string> = { "/sa": "/", "/sa/en": "/", "/en": "/" };

/** Lowercase, no trailing slash ("/SA/" → "/sa"), and legacy paths mapped to their new home. */
export function canonicalPath(pathname: string): string {
  let p = pathname.toLowerCase();
  if (p.length > 1) p = p.replace(/\/+$/, "") || "/";
  return LEGACY_PATHS[p] ?? p;
}

/** True for the landing page (and its aliases), the only paths the page rate limit applies to. */
export function isPagePath(pathname: string): boolean {
  return pageForPath(canonicalPath(pathname)) !== undefined;
}
