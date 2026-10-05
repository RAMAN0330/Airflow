"""Friendly default display names, derived deterministically from the learner id."""
import hashlib
import re

ADJECTIVES = [
    "Curious", "Patient", "Bold", "Clever", "Steady", "Bright", "Swift", "Calm", "Keen", "Lucid",
    "Nimble", "Quiet", "Sharp", "Witty", "Brave", "Eager", "Gentle", "Hardy", "Jolly", "Merry",
]
ANIMALS = [
    "Otter", "Falcon", "Panda", "Lynx", "Heron", "Badger", "Koala", "Marten", "Orca", "Puffin",
    "Raven", "Tapir", "Gecko", "Ibis", "Narwhal", "Quokka", "Bison", "Dingo", "Egret", "Moose",
]
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._-]{0,22}[A-Za-z0-9.]$")


def default_name(user_id: str) -> str:
    h = int(hashlib.sha256(user_id.encode()).hexdigest(), 16)
    return f"{ADJECTIVES[h % 20]} {ANIMALS[(h // 20) % 20]} {(h // 400) % 100:02d}"


def clean_name(raw: str) -> str | None:
    name = re.sub(r"\s+", " ", raw).strip()
    return name if NAME_RE.match(name) else None
