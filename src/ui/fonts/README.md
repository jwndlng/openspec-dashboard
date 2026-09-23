# Bundled fonts

Both fonts are inlined into `dist/ui/index.html` by `scripts/build-ui.ts`, so the UI renders offline and the binary
carries them. Each is the Latin subset of the font's variable-weight build, as a single `.woff2`.

| File | Font | Source | Licence |
| --- | --- | --- | --- |
| `Inter.woff2` | Inter (text) | `@fontsource-variable/inter` 5.3.0, `files/inter-latin-wght-normal.woff2`; upstream [rsms/inter](https://github.com/rsms/inter) | SIL Open Font License 1.1 |
| `JetBrainsMono.woff2` | JetBrains Mono (identifiers) | upstream [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) | SIL Open Font License 1.1 |

The OFL allows bundling and redistribution with software; the fonts themselves must not be sold on their own.
To update a font, replace its file with the Latin variable subset of the new release and update this table.
