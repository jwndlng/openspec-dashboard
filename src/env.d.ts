// Bun text imports: `import yaml from "./x.yaml" with { type: "text" }`.
declare module "*.yaml" {
  const content: string;
  export default content;
}
