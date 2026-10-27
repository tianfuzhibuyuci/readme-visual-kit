# Linklist — CLI fixture
A deliberately small, runnable fixture for README Visual Kit, not an external customer project.
Reads one Markdown file, extracts simple inline HTTP(S) links, deduplicates them and prints JSON.
It does not parse full CommonMark, fetch links or check their availability.

## Run
Requires Node.js 22+; no packages to install.
From this fixture directory:
`node main.mjs sample.md`
The output is a JSON array printed to standard output.
