# v0.1.0 verification record

Date: 2026-10-27. Local and publication verification are recorded separately below. These checks are not evidence of external adoption.

## Environment

- Windows; Node.js v24.14.1; Python 3.10.11.
- Headless Microsoft Edge 156.0.4314.42, controlled with Playwright from a local QA runtime. Playwright is not a product dependency.
- Desktop viewport: 1440 × 1050 (gallery screenshot: 1440 × 1080).
- Mobile-sized viewport: 390 × 844. This is emulation, not a physical-device test.

## Results

- `npm test`: **40 passed, 0 failed, 0 skipped**.
- Includes invalid schemas, source line bounds, traversal and symlink escapes, XML/HTML escaping, duplicate IDs/edges, cycles, uncertainty display, overwrite refusal, CLI execution, conservative CJK/wide-Latin wrapping, fixture reproducibility and renderer portability after copying out of the repository.
- All three fixture manifests validated. Their checked-in SVG and HTML outputs match fresh deterministic rendering in the test suite.
- CLI fixture executed and returned the expected deduplicated link list.
- Python fixture executed and returned `hello world` / `hello-world`.
- Browser fixture served on loopback: a Chinese note saved, persisted across reload and was removed after testing.
- **36 preview states** checked: 3 fixtures × 3 diagram tabs × 2 themes × 2 viewport sizes.
- Checked loaded images, theme-specific download targets, single active tab, arrow-key tab navigation, copy status/fallback, source disclosure expansion and absence of whole-page horizontal overflow.
- During the offline preview interaction matrix: no JavaScript page errors and no HTTP(S) requests.
- **18 SVGs** checked in the browser: text bounding boxes remained inside their SVG viewboxes. A stress case with a 60-character Chinese project name and repeated wide Latin glyphs also stayed within bounds.
- Visually reviewed the gallery, Chinese mobile dark preview and a branching library architecture diagram. Fixed English word splitting, wide-glyph overflow and a mobile grid min-width issue during QA.
- Bundled Skill frontmatter validator: passed. Renderer also worked after being copied into a separate temporary skill-style directory.

## Publication verification

- Published to https://github.com/tianfuzhibuyuci/readme-visual-kit.
- GitHub Actions run [40511732993](https://github.com/tianfuzhibuyuci/readme-visual-kit/actions/runs/40511732993), commit `0bc215f`: all four Windows/Ubuntu × Node.js 22/24 jobs passed, including 40 tests and three manifest checks per job.
- Initial Windows CI exposed CRLF checkout differences in generated HTML. A fresh clone with `core.autocrlf=true` reproduced the failure; enforcing LF in `.gitattributes` fixed it. A second fresh clone passed all 40 tests.
- GitHub Pages root returned HTTP 200 and redirected to the gallery. The Chinese and Python previews loaded their SVGs; the Chinese preview switched to architecture and dark theme, with all three dark SVGs loaded. No whole-page overflow at 390 px width or JavaScript errors were observed during the Chinese preview interaction check.
- Live gallery: https://tianfuzhibuyuci.github.io/readme-visual-kit/.

## Not established by these checks

- No real third-party repository adoption, Star growth or external user usability study.
- No independent agent behavioral evaluation; the Skill is packaged and its helper scripts validated, not proven across all agent clients.
- No macOS, Firefox, Safari or physical mobile execution. Ubuntu and Node 22 were tested in GitHub CI, not in the local browser session.
- Source references establish file/line existence, not factual correctness of claims or architecture edges.
- Font metrics vary. Bounding-box checks are not a guarantee for all fonts, scripts, emoji or every possible graph.

Screenshots: [desktop gallery](preview.png), [Chinese mobile preview](preview-mobile.png).
