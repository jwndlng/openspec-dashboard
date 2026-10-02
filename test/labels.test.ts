import { expect, test } from "bun:test";
import { REPO_HUES } from "../src/shared/hues.ts";
import { detectLabels, displayedLabels, LABEL_RULES, type LabelEntry, labelHue, nearestAssignableHue } from "../src/shared/labels.ts";

const files = (...names: string[]): LabelEntry[] => names.map((name) => ({ name, kind: "file" }));
const labelsOf = (...names: string[]) => detectLabels(files(...names)).map((d) => d.label);

test("every rule of the table detects its label", () => {
  const cases: [string, string][] = [
    ["main.tf", "terraform"],
    ["go.mod", "go"],
    ["Cargo.toml", "rust"],
    ["package.json", "javascript"],
    ["tsconfig.json", "typescript"],
    ["pyproject.toml", "python"],
    ["requirements.txt", "python"],
    ["setup.py", "python"],
    ["Pipfile", "python"],
    ["Gemfile", "ruby"],
    ["pom.xml", "java"],
    ["build.gradle", "java"],
    ["build.gradle.kts", "java"],
    ["App.csproj", "dotnet"],
    ["Demo.sln", "dotnet"],
    ["composer.json", "php"],
    ["Package.swift", "swift"],
    ["Dockerfile", "docker"],
    ["compose.yaml", "docker"],
    ["docker-compose.yml", "docker"],
    ["Chart.yaml", "helm"],
    ["ansible.cfg", "ansible"],
  ];
  for (const [name, label] of cases) expect(labelsOf(name)).toEqual([label]);
  expect(new Set(LABEL_RULES.map((r) => r.label)).size).toBe(14);
});

test("names match exactly and case-sensitively", () => {
  expect(labelsOf("dockerfile", "GO.MOD", ".tf", "main.tfvars", "README.md")).toEqual([]);
});

test("directories and symbolic links never match", () => {
  expect(detectLabels([{ name: "main.tf", kind: "dir" }, { name: "go.mod", kind: "other" }])).toEqual([]);
});

test("labels are sorted and listed once, the first rule giving the marker", () => {
  expect(detectLabels(files("Pipfile", "variables.tf", "pyproject.toml", "main.tf"))).toEqual([
    { label: "python", marker: "`pyproject.toml`" },
    { label: "terraform", marker: "`.tf` files" },
  ]);
});

test("custom labels come first in the user's order, then detected ones that are neither hidden nor shadowed", () => {
  const detected = detectLabels(files("main.tf", "go.mod", "Dockerfile"));
  expect(displayedLabels({ labels: ["client", "Go"], hiddenLabels: ["DOCKER"] }, detected)).toEqual([
    { label: "client", kind: "custom", hue: labelHue("client", undefined) },
    { label: "Go", kind: "custom", hue: labelHue("go", undefined) },
    { label: "terraform", kind: "detected", marker: "`.tf` files", hue: labelHue("terraform", undefined) },
  ]);
  expect(displayedLabels(undefined, undefined)).toEqual([]);
  expect(displayedLabels({ hiddenLabels: ["cobol"] }, detected).map((d) => d.label)).toEqual(["docker", "go", "terraform"]);
});

test("a label's derived hue depends on its name alone, ignoring case, and is always an assignable hue", () => {
  expect(labelHue("client", undefined)).toBe(labelHue("Client", undefined));
  expect(labelHue(" client ", {})).toBe(labelHue("client", undefined));
  // Pinned: a derived colour must not change between versions, machines or reloads.
  expect(labelHue("client", undefined)).toBe(226);
  for (const name of ["client", "terraform", "go", "docker", "infra", "x", "a much longer label name"]) {
    expect(REPO_HUES).toContain(labelHue(name, undefined));
  }
});

test("a chosen colour wins for the label's name ignoring case and is snapped to the palette", () => {
  expect(labelHue("Client", { client: 290 })).toBe(290);
  expect(labelHue("terraform", { client: 290 })).toBe(labelHue("terraform", undefined));
  expect(labelHue("client", { client: 295 })).toBe(290);
  expect(labelHue("client", { client: 0 })).toBe(350);
  expect(labelHue("client", { client: 359 })).toBe(350);
  expect(nearestAssignableHue(33)).toBe(27);
  expect(nearestAssignableHue(15)).toBe(27);
  // Inherited object keys are not choices.
  expect(labelHue("constructor", {})).toBe(labelHue("constructor", undefined));
  expect(REPO_HUES).toContain(labelHue("constructor", {}));
});

test("displayed labels carry their colour", () => {
  const detected = detectLabels(files("go.mod"));
  expect(displayedLabels({ labels: ["Client"] }, detected, { client: 190, go: 27 }).map((l) => [l.label, l.hue])).toEqual([
    ["Client", 190],
    ["go", 27],
  ]);
});
