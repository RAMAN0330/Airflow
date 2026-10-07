"""Sequential unlocking rules, as a pure function of a learner's state.

- Courses unlock in order within their track: course N needs every step of course N-1 completed.
  Tracks are independent, so each track's first course is open from the start.
- Pro courses also need the Pro plan.
- Inside a course, steps (lesson, then exercise, module by module) unlock one
  at a time: each needs the previous step completed.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from .catalog import Catalog, Step


@dataclass
class LockReason:
    kind: str  # "previous_step" | "previous_course" | "plan"
    message: str
    target: dict | None = None  # {"kind", "id", "title"} for previous_step, {"id", "title"} for previous_course

    def as_dict(self) -> dict:
        return {"kind": self.kind, "message": self.message, "target": self.target}


@dataclass
class StepState:
    status: str  # locked | available | in_progress | completed
    lock_reason: LockReason | None = None


@dataclass
class CourseState:
    status: str  # locked | upgrade_required | available | in_progress | completed
    completed_steps: int
    total_steps: int
    lock_reason: LockReason | None = None


@dataclass
class Progression:
    courses: dict[str, CourseState] = field(default_factory=dict)
    steps: dict[tuple[str, str], StepState] = field(default_factory=dict)

    def status(self, step: Step) -> str:
        return self.steps[step.key].status

    def unlocked(self, step: Step) -> bool:
        return self.steps[step.key].status != "locked"


def evaluate(
    catalog: Catalog,
    plan: str,
    completed_lessons: set[str],
    completed_exercises: set[str],
    attempted_exercises: set[str],
) -> Progression:
    prog = Progression()
    previous_course_done, previous_course, track = True, None, None

    for course in catalog.courses:
        if course.get("track_id") != track:  # a new track starts unlocked
            previous_course_done, previous_course, track = True, None, course.get("track_id")
        steps = catalog.steps_by_course[course["id"]]
        done = [
            (s.kind == "lesson" and s.id in completed_lessons) or (s.kind == "exercise" and s.id in completed_exercises)
            for s in steps
        ]
        n_done = sum(done)

        course_lock: LockReason | None = None
        if course.get("tier", "free") == "pro" and plan != "pro":
            course_lock = LockReason("plan", "Included with Pro")
        elif not previous_course_done:
            course_lock = LockReason(
                "previous_course",
                f"Finish “{previous_course['title']}” to unlock this course",
                {"id": previous_course["id"], "title": previous_course["title"]},
            )

        if course_lock:
            status = "upgrade_required" if course_lock.kind == "plan" else "locked"
            prog.courses[course["id"]] = CourseState(status, n_done, len(steps), course_lock)
            for s, is_done in zip(steps, done):
                prog.steps[s.key] = StepState("completed") if is_done else StepState("locked", course_lock)
        else:
            previous_done, previous_step = True, None
            for s, is_done in zip(steps, done):
                if is_done:
                    state = StepState("completed")
                elif previous_done:
                    attempted = s.kind == "exercise" and s.id in attempted_exercises
                    state = StepState("in_progress" if attempted else "available")
                else:
                    title = catalog.title(previous_step)
                    state = StepState("locked", LockReason(
                        "previous_step", f"Complete “{title}” first",
                        {"kind": previous_step.kind, "id": previous_step.id, "title": title},
                    ))
                prog.steps[s.key] = state
                previous_done, previous_step = is_done, s

            if steps and n_done == len(steps):
                status = "completed"
            elif n_done or any(s.kind == "exercise" and s.id in attempted_exercises for s in steps):
                status = "in_progress"
            else:
                status = "available"
            prog.courses[course["id"]] = CourseState(status, n_done, len(steps))

        # A course with no released steps yet never blocks the ones after it.
        previous_course_done = n_done == len(steps)
        previous_course = course

    return prog


def streaks(active_days: list[str], today: date | None = None) -> tuple[int, int]:
    """(current, longest) runs of consecutive active UTC days.

    The current streak survives until the end of the day after the last active day,
    so a learner who studied yesterday still has a live streak this morning.
    """
    days = sorted({date.fromisoformat(d) for d in active_days if d})
    if not days:
        return 0, 0
    longest = run = 1
    for prev, cur in zip(days, days[1:]):
        run = run + 1 if cur - prev == timedelta(days=1) else 1
        longest = max(longest, run)

    today = today or datetime.now(timezone.utc).date()
    if today - days[-1] > timedelta(days=1):
        return 0, longest
    current = 1
    for prev, cur in zip(reversed(days[:-1]), reversed(days)):
        if cur - prev != timedelta(days=1):
            break
        current += 1
    return current, longest
