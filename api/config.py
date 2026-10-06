"""Runtime settings, read once from the environment."""
import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    exercises_dir: Path = field(default_factory=lambda: Path(os.environ.get("EXERCISES_DIR", ROOT / "exercises")))
    datasets_dir: Path = field(default_factory=lambda: Path(os.environ.get("DATASETS_DIR", ROOT / "datasets")))
    lessons_dir: Path = field(default_factory=lambda: Path(os.environ.get("LESSONS_DIR", ROOT / "lessons")))
    database_path: Path = field(default_factory=lambda: Path(os.environ.get("DATABASE_PATH", ROOT / "data" / "platform.db")))
    max_concurrent_runs: int = field(default_factory=lambda: int(os.environ.get("MAX_CONCURRENT_RUNS", "4")))
    # "demo": checkout flips the plan instantly with no payment taken (for development and evaluation).
    # "disabled": billing endpoints return 501 until a payment provider is wired in.
    billing_mode: str = field(default_factory=lambda: os.environ.get("BILLING_MODE", "demo"))
    cors_origins: list[str] = field(default_factory=lambda: [
        o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
    ])
