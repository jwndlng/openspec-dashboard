import { expect, test } from "bun:test";
import { nextPreference, parsePreference, resolveTheme } from "../src/ui/theme.ts";

test("parsePreference accepts explicit themes", () => {
  expect(parsePreference("light")).toBe("light");
  expect(parsePreference("dark")).toBe("dark");
});

test("parsePreference treats missing or unrecognised values as system", () => {
  expect(parsePreference(null)).toBe("system");
  expect(parsePreference(undefined)).toBe("system");
  expect(parsePreference("")).toBe("system");
  expect(parsePreference("system")).toBe("system");
  expect(parsePreference("purple")).toBe("system");
});

test("resolveTheme follows the system only when the preference is system", () => {
  expect(resolveTheme("system", true)).toBe("dark");
  expect(resolveTheme("system", false)).toBe("light");
  expect(resolveTheme("light", true)).toBe("light");
  expect(resolveTheme("light", false)).toBe("light");
  expect(resolveTheme("dark", true)).toBe("dark");
  expect(resolveTheme("dark", false)).toBe("dark");
});

test("nextPreference cycles system → light → dark → system", () => {
  expect(nextPreference("system")).toBe("light");
  expect(nextPreference("light")).toBe("dark");
  expect(nextPreference("dark")).toBe("system");
});
