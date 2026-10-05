"""Content catalog: exercises, lessons and the ordered course sequence.

The course order in curriculum.json is the single source of truth for
unlocking: steps unlock one after another within a course, and each course
unlocks once the previous one is complete.
"""
import json
from dataclasses import dataclass
from pathlib import Path

LESSON_XP = 25
EXERCISE_XP = {"beginner": 100, "intermediate": 200, "advanced": 300}
TIERS = ("free", "pro")


@dataclass(frozen=True)
class Exercise:
    id: str
    dir: Path
    meta: dict
    task_markdown: str
    starter_code: str

    @property
    def title(self) -> str:
        return self.meta["title"]

    @property
    def xp(self) -> int:
        return EXERCISE_XP.get(self.meta.get("difficulty", "beginner"), 100)


@dataclass(frozen=True)
class Lesson:
    id: str
    title: str
    estimated_minutes: int
    markdown: str
    questions: tuple

    xp = LESSON_XP

    def public_questions(self) -> list[dict]:
        return [{"id": q["id"], "prompt": q["prompt"], "options": q["options"]} for q in self.questions]

    def grade(self, answers: dict[str, int]) -> list[dict]:
        return [
            {
                "id": q["id"],
                "correct": answers.get(q["id"]) == q["answer"],
                # Explanations are revealed only once the learner gets the question right.
                "explanation": q["explanation"] if answers.get(q["id"]) == q["answer"] else None,
            }
            for q in self.questions
        ]


@dataclass(frozen=True)
class Step:
    kind: str  # "lesson" | "exercise"
    id: str
    course_id: str
    module_id: str
    module_title: str
    index: int  # position within the course

    @property
    def key(self) -> tuple[str, str]:
        return (self.kind, self.id)


class Catalog:
    def __init__(self, exercises_dir: Path, lessons_dir: Path):
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

        self.lessons: dict[str, Lesson] = {}
        for meta_path in sorted(lessons_dir.glob("*/lesson.json")):
            d = meta_path.parent
            meta = json.loads(meta_path.read_text())
            if meta["id"] != d.name:
                raise ValueError(f"{meta_path}: id {meta['id']!r} must match directory name")
            questions = json.loads((d / "quiz.json").read_text())["questions"]
            for q in questions:
                if not 0 <= q["answer"] < len(q["options"]):
                    raise ValueError(f"{d.name}/{q['id']}: answer index out of range")
            self.lessons[meta["id"]] = Lesson(
                id=meta["id"], title=meta["title"], estimated_minutes=meta.get("estimated_minutes", 10),
                markdown=(d / "lesson.md").read_text(), questions=tuple(questions),
            )

        self.courses: list[dict] = json.loads((exercises_dir / "curriculum.json").read_text())["courses"]
        self.course_by_id = {c["id"]: c for c in self.courses}
        self.steps: list[Step] = []
        self.steps_by_course: dict[str, list[Step]] = {}
        self._build_steps()
        self.step_by_key = {s.key: s for s in self.steps}

    def _build_steps(self):
        seen: set[tuple[str, str]] = set()
        if len(self.course_by_id) != len(self.courses):
            raise ValueError("duplicate course id in curriculum.json")
        for course in self.courses:
            if course.get("tier", "free") not in TIERS:
                raise ValueError(f"course {course['id']!r}: tier must be one of {TIERS}")
            steps = []
            for module in course["modules"]:
                for kind, ref, registry in (("lesson", module.get("lesson"), self.lessons),
                                            ("exercise", module.get("exercise"), self.exercises)):
                    if not ref:
                        continue
                    if ref not in registry:
                        raise ValueError(f"module {module['id']!r}: unknown {kind} {ref!r}")
                    if (kind, ref) in seen:
                        raise ValueError(f"{kind} {ref!r} appears more than once in the curriculum")
                    seen.add((kind, ref))
                    steps.append(Step(kind, ref, course["id"], module["id"], module["title"], len(steps)))
            self.steps_by_course[course["id"]] = steps
            self.steps.extend(steps)

        unused = [e for e in self.exercises if ("exercise", e) not in seen] + \
                 [lesson for lesson in self.lessons if ("lesson", lesson) not in seen]
        if unused:
            raise ValueError(f"content not referenced by curriculum.json: {unused}")
        for ex in self.exercises.values():
            for entry in ex.meta.get("remediation", {}).values():
                if entry.get("exercise") and entry["exercise"] not in self.exercises:
                    raise ValueError(f"{ex.id}: remediation points to unknown exercise {entry['exercise']!r}")

    def title(self, step: Step) -> str:
        return self.lessons[step.id].title if step.kind == "lesson" else self.exercises[step.id].title

    def xp(self, step: Step) -> int:
        return self.lessons[step.id].xp if step.kind == "lesson" else self.exercises[step.id].xp

    def minutes(self, step: Step) -> int:
        if step.kind == "lesson":
            return self.lessons[step.id].estimated_minutes
        return self.exercises[step.id].meta.get("estimated_minutes", 20)

    def module_steps(self, step: Step) -> list[Step]:
        return [s for s in self.steps_by_course[step.course_id] if s.module_id == step.module_id]

    def next_step(self, step: Step) -> Step | None:
        i = self.steps.index(step)
        return self.steps[i + 1] if i + 1 < len(self.steps) else None
