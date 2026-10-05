// Mirrors api/schemas.py.

export type StepStatus = "locked" | "available" | "in_progress" | "completed"
export type CourseStatus = "locked" | "upgrade_required" | "available" | "in_progress" | "completed"
export type RunStatus = "passed" | "failed" | "error" | "timeout"
export type Difficulty = "beginner" | "intermediate" | "advanced"
export type Plan = "free" | "pro"
export type StepKind = "lesson" | "exercise"

export interface LockReason {
  kind: "previous_step" | "previous_course" | "plan"
  message: string
  target: { kind?: StepKind; id: string; title: string } | null
}

export interface StepRef {
  kind: StepKind
  id: string
  title: string
  status: StepStatus
  course_id: string
}

export interface StepSummary extends StepRef {
  xp: number
  estimated_minutes: number
  lock_reason: LockReason | null
  difficulty: Difficulty | null
  attempts: number
  best_score: number | null
}

export interface ModuleSummary {
  id: string
  title: string
  concepts: string[]
  coming_soon: boolean
  lesson: StepSummary | null
  exercise: StepSummary | null
}

export interface CourseRef {
  id: string
  title: string
  tier: Plan
}

export interface Course {
  id: string
  title: string
  tagline: string
  description: string
  level: string
  tier: Plan
  position: number
  status: CourseStatus
  lock_reason: LockReason | null
  completed_steps: number
  total_steps: number
  estimated_minutes: number
  total_xp: number
  modules: ModuleSummary[]
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
}

export interface LessonDetail {
  id: string
  title: string
  markdown: string
  estimated_minutes: number
  xp: number
  status: StepStatus
  lock_reason: LockReason | null
  completed_at: string | null
  course: CourseRef
  module_title: string
  questions: QuizQuestion[]
  next: StepRef | null
}

export interface QuizAttemptResult {
  passed: boolean
  results: { id: string; correct: boolean; explanation: string | null }[]
  newly_completed: boolean
  xp_earned: number
  unlocked: StepRef[]
}

export interface ExerciseDetail {
  id: string
  title: string
  summary: string
  difficulty: Difficulty
  estimated_minutes: number
  tags: string[]
  xp: number
  status: StepStatus
  lock_reason: LockReason | null
  attempts: number
  best_score: number | null
  course: CourseRef
  module_title: string
  lesson: StepRef | null
  next: StepRef | null
  task_markdown: string
  starter_code: string
  time_limit_seconds: number
}

export interface TestResult {
  name: string
  outcome: "passed" | "failed" | "skipped"
  error_type: string | null
  message: string | null
  hint: string | null
  duration_ms: number
}

export interface Remediation {
  tag: string
  hint: string
  exercise: string | null
}

export interface RunResult {
  status: RunStatus
  passed_tests: number
  total_tests: number
  score: number
  tests: TestResult[]
  stdout: string
  stderr: string
  duration_ms: number
  error_tags: string[]
  remediation: Remediation[]
}

export interface Submission {
  id: string
  exercise_id: string
  created_at: string
  status: RunStatus
  passed_tests: number
  total_tests: number
  score: number
  duration_ms: number
  code: string | null
  result: RunResult | null
}

export interface SubmissionOut extends Submission {
  newly_completed: boolean
  xp_earned: number
  unlocked: StepRef[]
}

export interface Me {
  display_name: string
  plan: Plan
  xp: number
  rank: number | null
  exercises_completed: number
  lessons_completed: number
  billing_mode: "demo" | "disabled" | string
}

export interface ActivityDay {
  day: string
  submissions: number
  passed: number
}

export interface ExerciseProgress {
  exercise: StepSummary
  course_title: string
  completed_at: string | null
  last_attempt_at: string | null
}

export interface CourseProgress {
  id: string
  title: string
  status: CourseStatus
  completed_steps: number
  total_steps: number
}

export interface Progress {
  xp: number
  rank: number | null
  total_exercises: number
  exercises_completed: number
  total_lessons: number
  lessons_completed: number
  total_submissions: number
  pass_rate: number
  courses: CourseProgress[]
  exercises: ExerciseProgress[]
  recent: Submission[]
  activity: ActivityDay[]
  next_up: StepRef | null
}

export type LeaderboardPeriod = "all" | "week"

export interface LeaderboardEntry {
  rank: number
  display_name: string
  xp: number
  exercises_completed: number
  lessons_completed: number
  is_me: boolean
}

export interface Leaderboard {
  period: LeaderboardPeriod
  total_learners: number
  entries: LeaderboardEntry[]
  me: LeaderboardEntry | null
}
