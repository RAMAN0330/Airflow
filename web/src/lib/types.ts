// Mirrors api/schemas.py.

export type ExerciseStatus = "locked" | "available" | "in_progress" | "completed"
export type RunStatus = "passed" | "failed" | "error" | "timeout"
export type Difficulty = "beginner" | "intermediate" | "advanced"

export interface ExerciseSummary {
  id: string
  title: string
  summary: string
  phase: number
  difficulty: Difficulty
  estimated_minutes: number
  tags: string[]
  prerequisites: string[]
  status: ExerciseStatus
  attempts: number
  best_score: number | null
}

export interface Module {
  id: string
  title: string
  concepts: string[]
  exercise: ExerciseSummary | null
}

export interface Phase {
  id: number
  title: string
  description: string
  modules: Module[]
}

export interface Curriculum {
  phases: Phase[]
}

export interface ExerciseRef {
  id: string
  title: string
  status: ExerciseStatus
}

export interface ExerciseDetail extends ExerciseSummary {
  task_markdown: string
  starter_code: string
  prerequisite_details: ExerciseRef[]
  unlocks: ExerciseRef[]
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
  unlocked: ExerciseRef[]
}

export interface ActivityDay {
  day: string
  submissions: number
  passed: number
}

export interface ExerciseProgress {
  exercise: ExerciseSummary
  completed_at: string | null
  last_attempt_at: string | null
}

export interface Progress {
  total_exercises: number
  completed: number
  in_progress: number
  available: number
  total_submissions: number
  pass_rate: number
  exercises: ExerciseProgress[]
  recent: Submission[]
  activity: ActivityDay[]
  next_up: ExerciseSummary | null
}
