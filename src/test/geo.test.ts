import { describe, expect, it } from "vitest";
import { geoDecision, isPagePath, normalizePath } from "@/lib/geo";

describe("geo gate", () => {
  it("serves the page to visitors from Saudi Arabia", () => {
    expect(geoDecision("/", "SA")).toEqual({ action: "serve" });
    expect(geoDecision("/", "sa")).toEqual({ action: "serve" });
  });

  it("blocks every other country, including the rest of the Gulf", () => {
    for (const cc of ["AE", "KW", "QA", "BH", "OM", "JO", "LB", "GB", "IT", "DE", "US", "EG"]) {
      expect(geoDecision("/", cc)).toEqual({ action: "block" });
    }
  });

  it("blocks a missing or unknown country", () => {
    expect(geoDecision("/", null)).toEqual({ action: "block" });
    expect(geoDecision("/", undefined)).toEqual({ action: "block" });
    expect(geoDecision("/", "XX")).toEqual({ action: "block" });
  });

  it("redirects the old /sa URLs to / for Saudi visitors", () => {
    expect(normalizePath("/SA/")).toBe("/");
    expect(normalizePath("/sa/en")).toBe("/");
    expect(normalizePath("/en")).toBe("/");
    expect(geoDecision("/sa", "SA")).toEqual({ action: "redirect", to: "/" });
    expect(geoDecision("/sa", "AE")).toEqual({ action: "block" });
  });

  it("only applies to the landing page", () => {
    expect(isPagePath("/")).toBe(true);
    expect(isPagePath("/sa")).toBe(true);
    expect(isPagePath("/favicon.ico")).toBe(false);
    expect(isPagePath("/assets/app.js")).toBe(false);
    expect(isPagePath("/de")).toBe(false);
  });
});
