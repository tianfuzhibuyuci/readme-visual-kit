# Manifest v1 reference

UTF-8 JSON; maximum input size 256 KiB. Unknown properties are errors.

| Field | Requirement |
|---|---|
| `version` | Integer `1` |
| `project` | 1–60 Unicode code points |
| `tagline` | 1–120 code points |
| `diagrams` | Exactly one `overview`, one `architecture`, one `quickstart` |
| Diagram `title` | 1–64 code points |
| Diagram `nodes` | 2–6 nodes |
| Architecture `edges` | 1–12 unique `{ "from": "id", "to": "id" }` pairs; DAG only |
| Node `id` | Unique in diagram; lowercase slug, starts with a letter, at most 32 characters |
| Node `label` | 1–64 code points; shorter labels read better |
| Node `detail` | 1–180 code points |
| Node `command` | Required only for quickstart; 1–240 code points; display only, never executed |
| Node `uncertainty` | Optional 1–100 code point explanation, visibly shown on the card |
| Node `evidence` | 1–4 source ranges |

A source range is `{ "path": "src/main.js", "start": 4, "end": 12 }`.
Paths are relative to `--root`, use `/` even on Windows, cannot traverse parents or escape through symlinks. Sources must be UTF-8 files at most 1 MiB, without NUL bytes. Line ranges are inclusive and 1-based, limited to 80 lines and 20,000 excerpt characters. A final newline does not count as an extra line.

Source excerpts are copied into `evidence.json` and `index.html`. **Review for private information before publishing.** File existence is not proof that a diagram's claim or an edge is correct. Recheck after source changes; there is no immutable commit pinning in v0.1.

## Shape of a node

```json
{
  "id": "parse",
  "label": "Extract links",
  "detail": "Keep inline HTTP(S) links and remove duplicates.",
  "evidence": [{ "path": "main.mjs", "start": 6, "end": 7 }]
}
```

Overview and quickstart arrows follow node order. Architecture arrows follow `edges` and are laid out topologically. At most two nodes share a rendered row. Cross-layer edges may share an outer lane: simplify dense graphs rather than using the result as a precise engineering drawing. Semantic grouping is the author/agent's responsibility.

## Commands

```sh
node scripts/cli.mjs check examples/cli/visuals.json --root examples/cli
node scripts/cli.mjs render examples/cli/visuals.json --root examples/cli --out demo
```

`--root` is required. `--out` is required for render and forbidden for check. Its parent must exist; its final directory must not exist. Exit status is 0 on success, 1 on failure. The CLI refuses unknown and duplicate options. It performs no network requests, does not modify input sources and does not run any displayed commands.

## Bundle contents

Six SVGs (`TYPE.light.svg` / `TYPE.dark.svg`), `visuals.json`, `evidence.json`, `README-snippet.md`, `index.html`. JSON is the canonical editable source; change it and render to a new directory. SVG can also be edited in a vector editor, but those changes do not flow back to the JSON. Font metrics vary by operating system; complex scripts/emoji may need manual visual review. No fonts are downloaded.
