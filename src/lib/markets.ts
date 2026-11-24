/**
 * The one market this site serves: Saudi Arabia, in Arabic, at `/`. Visitors from any other
 * country are refused by src/server.ts.
 */
export type Lang = "ar";
export type MarketId = "sa";

export const MARKETS = {
  sa: { countries: ["SA"], home: "/", dialCodes: ["+966"], defaultDial: "+966" },
} as const satisfies Record<
  MarketId,
  {
    /** ISO countries (Cloudflare's CF-IPCountry) whose visitors may see the page. */
    countries: readonly string[];
    home: string;
    dialCodes: readonly string[];
    defaultDial: string;
  }
>;

export const PAGES = {
  "sa-ar": { market: "sa", lang: "ar", path: "/" },
} as const satisfies Record<string, { market: MarketId; lang: Lang; path: string }>;

export type PageId = keyof typeof PAGES;

export function pageForPath(pathname: string): PageId | undefined {
  return (Object.keys(PAGES) as PageId[]).find((id) => PAGES[id].path === pathname);
}

/** True when visitors from this ISO country may see the landing page. */
export function isAllowedCountry(country: string | null | undefined): boolean {
  const iso = country?.trim().toUpperCase() ?? "";
  return (MARKETS.sa.countries as readonly string[]).includes(iso);
}
