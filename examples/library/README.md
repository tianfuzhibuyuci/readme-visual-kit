# Text Utils — Python library fixture
A small runnable fixture created for README Visual Kit, not an external adoption claim.
Provides normalize_space and slugify using only Python's standard library.
normalize_space collapses whitespace; slugify lowercases and replaces non-word runs with dashes.
Unicode word characters are preserved. This is not a security or filename-sanitization library.

## Try
Requires Python 3.10+; no installation dependencies.
From this directory, run `python demo.py`.
The first output is `hello world`; the second is `hello-world`.
