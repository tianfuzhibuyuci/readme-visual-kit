"""Tiny text helpers for the demonstration fixture."""
import re

def normalize_space(text: str) -> str:
    return " ".join(text.split())

def slugify(text: str) -> str:
    return re.sub(r"[^\w]+", "-", normalize_space(text).lower(), flags=re.UNICODE).strip("-")
