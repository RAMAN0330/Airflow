"""Pydantic request/response models (mirrored in web/src/lib/types.ts)."""
from typing import Literal

from pydantic import BaseModel, Field

StepStatus = Literal["locked", "available", "in_progress", "completed"]
CourseStatus = Literal["locked", "upgrade_required", "available", "in_progress", "completed"]
RunStatus = Literal["passed", "failed", "error", "timeout"]
Plan = Literal["free", "pro"]


class LockReason(BaseModel):
    kind: Literal["previous_step", "previous_course", "plan"]
    message: str
    target: dict | None = None


class StepRef(BaseModel):
    kind: Literal["lesson", "exercise"]
    id: str
    title: str
    status: StepStatus
    course_id: str


class StepSummary(StepRef):
    xp: int
    estimated_minutes: int
    lock_reason: LockReason | None = None
    difficulty: str | None = None
    attempts: int = 0
    best_score: float | None = None


class ModuleSummary(BaseModel):
    id: str
    title: str
    concepts: list[str]
    coming_soon: bool
    lesson: StepSummary | None
    exercise: StepSummary | None


class CourseRef(BaseModel):
    id: str
    title: str
    tier: Plan
    track_id: str
    track_title: str


class Course(BaseModel):
    id: str
    track_id: str
    title: str
    tagline: str
    description: str
    level: str
    tier: Plan
    position: int
    status: CourseStatus
    lock_reason: LockReason | None
    completed_steps: int
    total_steps: int
    estimated_minutes: int
    total_xp: int
    modules: list[ModuleSummary]


class Track(BaseModel):
    id: str
    title: str
    tagline: str
    description: str
    icon: str
    status: CourseStatus
    completed_steps: int
    total_steps: int
    courses: list[Course]


# ------------------------------------------------------------------ lessons

class FlowStep(BaseModel):
    label: str
    detail: str


class Flow(BaseModel):
    title: str
    steps: list[FlowStep]


class Term(BaseModel):
    term: str
    definition: str


class Source(BaseModel):
    title: str
    author: str | None = None
    publisher: str | None = None
    year: int | None = None
    url: str
    kind: Literal["paper", "docs", "book", "course", "article"]


class OutlineModule(BaseModel):
    id: str
    title: str
    steps: list[StepRef]

class QuizQuestion(BaseModel):
    id: str
    prompt: str
    options: list[str]


class LessonDetail(BaseModel):
    id: str
    title: str
    markdown: str
    estimated_minutes: int
    xp: int
    status: StepStatus
    lock_reason: LockReason | None
    completed_at: str | None
    course: CourseRef
    module_title: str
    questions: list[QuizQuestion]
    next: StepRef | None
    summary: str
    takeaways: list[str]
    flow: Flow | None
    terms: list[Term]
    sources: list[Source]
    outline: list[OutlineModule]


class QuizAttemptIn(BaseModel):
    answers: dict[str, int]


class QuestionResult(BaseModel):
    id: str
    correct: bool
    explanation: str | None


class QuizAttemptOut(BaseModel):
    passed: bool
    results: list[QuestionResult]
    newly_completed: bool
    xp_earned: int
    unlocked: list[StepRef]


# ------------------------------------------------------------------ exercises

class ExerciseDetail(BaseModel):
    id: str
    title: str
    summary: str
    difficulty: str
    estimated_minutes: int
    tags: list[str]
    xp: int
    status: StepStatus
    lock_reason: LockReason | None
    attempts: int
    best_score: float | None
    course: CourseRef
    module_title: str
    lesson: StepRef | None
    next: StepRef | None
    task_markdown: str
    starter_code: str
    time_limit_seconds: int
    outline: list[OutlineModule]


class TestResult(BaseModel):
    name: str
    outcome: str
    error_type: str | None = None
    message: str | None = None
    hint: str | None = None
    duration_ms: float


class Remediation(BaseModel):
    tag: str
    hint: str
    exercise: str | None = None


class RunResult(BaseModel):
    status: RunStatus
    passed_tests: int
    total_tests: int
    score: float
    tests: list[TestResult]
    stdout: str
    stderr: str
    duration_ms: int
    error_tags: list[str]
    remediation: list[Remediation]


class SubmissionIn(BaseModel):
    code: str = Field(min_length=1, max_length=100_000)


class Submission(BaseModel):
    id: str
    exercise_id: str
    created_at: str
    status: RunStatus
    passed_tests: int
    total_tests: int
    score: float
    duration_ms: int
    code: str | None = None
    result: RunResult | None = None


class SubmissionOut(Submission):
    newly_completed: bool
    xp_earned: int
    unlocked: list[StepRef]


# ------------------------------------------------------------------ learner

class Me(BaseModel):
    display_name: str
    plan: Plan
    xp: int
    rank: int | None
    exercises_completed: int
    lessons_completed: int
    billing_mode: str


class MeUpdate(BaseModel):
    display_name: str = Field(min_length=2, max_length=24)


class CheckoutIn(BaseModel):
    plan: Literal["pro"] = "pro"
    interval: Literal["month", "year"] = "month"


class ActivityDay(BaseModel):
    day: str
    submissions: int
    passed: int


class ExerciseProgress(BaseModel):
    exercise: StepSummary
    course_title: str
    completed_at: str | None
    last_attempt_at: str | None


class CourseProgress(BaseModel):
    id: str
    track_id: str
    title: str
    status: CourseStatus
    completed_steps: int
    total_steps: int


class Progress(BaseModel):
    xp: int
    rank: int | None
    total_exercises: int
    exercises_completed: int
    total_lessons: int
    lessons_completed: int
    total_submissions: int
    pass_rate: float
    courses: list[CourseProgress]
    exercises: list[ExerciseProgress]
    recent: list[Submission]
    activity: list[ActivityDay]
    next_up: StepRef | None


class LeaderboardEntry(BaseModel):
    rank: int
    display_name: str
    xp: int
    exercises_completed: int
    lessons_completed: int
    is_me: bool


class Leaderboard(BaseModel):
    period: Literal["all", "week"]
    total_learners: int
    entries: list[LeaderboardEntry]
    me: LeaderboardEntry | None


# ------------------------------------------------------------------ library

class LessonLink(BaseModel):
    id: str
    title: str
    course_id: str
    track_id: str


class LibrarySource(Source):
    track_ids: list[str]
    lessons: list[LessonLink]


class LibraryTerm(Term):
    lesson: LessonLink


class Library(BaseModel):
    sources: list[LibrarySource]
    terms: list[LibraryTerm]


# ------------------------------------------------------------------ playground

class PlaygroundColumn(BaseModel):
    name: str
    type: str
    pk: bool
    references: str | None


class PlaygroundTable(BaseModel):
    name: str
    row_count: int
    columns: list[PlaygroundColumn]


class PlaygroundSample(BaseModel):
    title: str
    sql: str


class PlaygroundSchema(BaseModel):
    dataset: str
    description: str
    tables: list[PlaygroundTable]
    samples: list[PlaygroundSample]


class PlaygroundIn(BaseModel):
    sql: str = Field(min_length=1, max_length=20_000)


class PlaygroundResultSet(BaseModel):
    statement: int
    sql: str
    columns: list[str]
    rows: list[list]
    truncated: bool
    rows_affected: int | None = None


class PlaygroundOut(BaseModel):
    results: list[PlaygroundResultSet]
    statements: int
    error: str | None
    duration_ms: float
