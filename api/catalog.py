"""Exercise catalog: loads exercises and the curriculum, and validates the prerequisite DAG."""
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Exercise:
    id: str
    dir: Path
    meta: dict
    task_markdown: str
    starter_code: str

    @property
    def prerequisites(self) -> list[str]:
        return self.meta.get("prerequisites", [])

    def summary(self) -> dict:
        m = self.meta
        return {
            "id": self.id,
            "title": m["title"],
            "summary": m.get("summary", ""),
            "phase": m["phase"],
            "difficulty": m.get("difficulty", "beginner"),
            "estimated_minutes": m.get("estimated_minutes", 20),
            "tags": m.get("tags", []),
            "prerequisites": self.prerequisites,
        }


class Catalog:
    def __init__(self, exercises_dir: Path):
        self.dir = exercises_dir
        self.exercises: dict[str, Exercise] = {}
        for meta_path in sorted(exercises_dir.glob("*/exercise.json")):
            d = meta_path.parent
            meta = json.loads(meta_path.read_text())
            if meta["id"] != d.name:
                raise ValueError(f"{meta_path}: id {meta['id']!r} must match directory name")
            self.exercises[meta["id"]] = Exercise(
                id=meta["id"], dir=d, meta=meta,
                task_markdown=(d / "task.md").read_text(),
                starter_code=(d / "starter.py").read_text(),
            )
        self.curriculum = json.loads((exercises_dir / "curriculum.json").read_text())
        self.order = self._validate()

    def _validate(self) -> list[str]:
        """Check references and acyclicity; return exercises in topological order."""
        for ex in self.exercises.values():
            for p in ex.prerequisites:
                if p not in self.exercises:
                    raise ValueError(f"{ex.id}: unknown prerequisite {p!r}")
            for entry in ex.meta.get("remediation", {}).values():
                if entry.get("exercise") and entry["exercise"] not in self.exercises:
                    raise ValueError(f"{ex.id}: remediation points to unknown exercise {entry['exercise']!r}")
        for phase in self.curriculum["phases"]:
            for module in phase["modules"]:
                if module["exercise"] and module["exercise"] not in self.exercises:
                    raise ValueError(f"curriculum module {module['id']!r}: unknown exercise {module['exercise']!r}")

        order, state = [], {}

        def visit(eid, path):
            if state.get(eid) == "done":
                return
            if state.get(eid) == "visiting":
                raise ValueError(f"prerequisite cycle: {' -> '.join(path + [eid])}")
            state[eid] = "visiting"
            for p in self.exercises[eid].prerequisites:
                visit(p, path + [eid])
            state[eid] = "done"
            order.append(eid)

        for eid in self.exercises:
            visit(eid, [])
        return order

    def unlocks(self, exercise_id: str) -> list[str]:
        return [e.id for e in self.exercises.values() if exercise_id in e.prerequisites]

    def statuses(self, completed: set[str], attempted: set[str]) -> dict[str, str]:
        out = {}
        for eid, ex in self.exercises.items():
            if eid in completed:
                out[eid] = "completed"
            elif not all(p in completed for p in ex.prerequisites):
                out[eid] = "locked"
            elif eid in attempted:
                out[eid] = "in_progress"
            else:
                out[eid] = "available"
        return out
