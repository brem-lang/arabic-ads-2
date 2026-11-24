/**
 * The one market this site targets: Saudi Arabia, in Arabic, at `/`. The page is open to
 * visitors from any country; the lead form only accepts Saudi (+966) mobiles.
 */
export type Lang = "ar";
export type MarketId = "sa";

export const MARKETS = {
  sa: { home: "/", dialCodes: ["+966"], defaultDial: "+966" },
} as const satisfies Record<
  MarketId,
  {
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
