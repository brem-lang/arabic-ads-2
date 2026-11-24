import { describe, expect, it } from "vitest";
import { canonicalPath, isPagePath } from "@/lib/paths";

describe("landing page paths", () => {
  it("redirects the old /sa URLs to /", () => {
    expect(canonicalPath("/")).toBe("/");
    expect(canonicalPath("/sa")).toBe("/");
    expect(canonicalPath("/SA/")).toBe("/");
    expect(canonicalPath("/sa/en")).toBe("/");
    expect(canonicalPath("/en")).toBe("/");
  });

  it("only treats the landing page and its aliases as page paths", () => {
    expect(isPagePath("/")).toBe(true);
    expect(isPagePath("/sa")).toBe(true);
    expect(isPagePath("/favicon.ico")).toBe(false);
    expect(isPagePath("/assets/app.js")).toBe(false);
    expect(isPagePath("/de")).toBe(false);
  });
});
