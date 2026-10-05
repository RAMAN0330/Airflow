"""Pydantic response/request models (the API contract mirrored in web/src/lib/types.ts)."""
from typing import Literal

from pydantic import BaseModel, Field

Status = Literal["locked", "available", "in_progress", "completed"]
RunStatus = Literal["passed", "failed", "error", "timeout"]


class ExerciseSummary(BaseModel):
    id: str
    title: str
    summary: str
    phase: int
    difficulty: str
    estimated_minutes: int
    tags: list[str]
    prerequisites: list[str]
    status: Status
    attempts: int = 0
    best_score: float | None = None


class Module(BaseModel):
    id: str
    title: str
    concepts: list[str]
    exercise: ExerciseSummary | None


class Phase(BaseModel):
    id: int
    title: str
    description: str
    modules: list[Module]


class Curriculum(BaseModel):
    phases: list[Phase]


class ExerciseRef(BaseModel):
    id: str
    title: str
    status: Status


class ExerciseDetail(ExerciseSummary):
    task_markdown: str
    starter_code: str
    prerequisite_details: list[ExerciseRef]
    unlocks: list[ExerciseRef]
    time_limit_seconds: int


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
    unlocked: list[ExerciseRef]


class ActivityDay(BaseModel):
    day: str
    submissions: int
    passed: int


class ExerciseProgress(BaseModel):
    exercise: ExerciseSummary
    completed_at: str | None
    last_attempt_at: str | None


class Progress(BaseModel):
    total_exercises: int
    completed: int
    in_progress: int
    available: int
    total_submissions: int
    pass_rate: float
    exercises: list[ExerciseProgress]
    recent: list[Submission]
    activity: list[ActivityDay]
    next_up: ExerciseSummary | None
