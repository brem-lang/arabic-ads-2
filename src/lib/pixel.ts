// Meta (Facebook) Pixel. The ID is public (it is visible in every page that loads the pixel),
// so it is a VITE_* variable, built into the page at build time.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Pixel IDs are numeric; anything else is ignored so it can't be injected into the inline script. */
export function metaPixelId(): string | undefined {
  const id = import.meta.env["VITE_META_PIXEL_ID"] as string | undefined;
  return id && /^\d+$/.test(id) ? id : undefined;
}

/** Meta's standard base code: loads fbevents.js, then sends a PageView. */
export function metaPixelScript(id: string): string {
  return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');`;
}

/** Sends a standard event (e.g. "Lead"); does nothing when the pixel isn't loaded. */
export function trackPixel(event: string, params?: Record<string, unknown>): void {
  window.fbq?.("track", event, params);
}
