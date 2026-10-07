// `.openspec.yaml` and `openspec/config.yaml` are flat enough to read without a YAML parser.
const SCHEMA_LINE = /^schema:\s*["']?([A-Za-z0-9._-]+)/m;
const CREATED_LINE = /^created:\s*["']?(\d{4}-\d{2}-\d{2})/m;
const SKIP_SPECS_LINE = /^skip_specs:\s*true\b/m;

export interface Marker {
  schema?: string;
  created?: string;
  skipSpecs: boolean;
}

export function parseMarker(text: string | undefined): Marker {
  if (!text) return { skipSpecs: false };
  return { schema: SCHEMA_LINE.exec(text)?.[1], created: CREATED_LINE.exec(text)?.[1], skipSpecs: SKIP_SPECS_LINE.test(text) };
}
