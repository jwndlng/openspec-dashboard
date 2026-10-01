import { expect, test } from "bun:test";
import { detectLabels, displayedLabels, LABEL_RULES, type LabelEntry } from "../src/shared/labels.ts";

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
    { label: "client", kind: "custom" },
    { label: "Go", kind: "custom" },
    { label: "terraform", kind: "detected", marker: "`.tf` files" },
  ]);
  expect(displayedLabels(undefined, undefined)).toEqual([]);
  expect(displayedLabels({ hiddenLabels: ["cobol"] }, detected).map((d) => d.label)).toEqual(["docker", "go", "terraform"]);
});
