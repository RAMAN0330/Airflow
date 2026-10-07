import { useUserStore } from "@/stores/user-store"
import type {
  Certificate,
  Course,
  ExerciseDetail,
  Leaderboard,
  LeaderboardPeriod,
  Library,
  PlaygroundResult,
  PlaygroundSchema,
  Track,
  LessonDetail,
  Me,
  Progress,
  QuizAttemptResult,
  ReviewDeck,
  Solution,
  Submission,
  SubmissionOut,
} from "@/lib/types"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const userId = useUserStore.getState().ensureUserId()
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "X-User-Id": userId, ...init?.headers },
    })
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.")
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail)
    } catch {}
    throw new ApiError(res.status, detail || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

const enc = encodeURIComponent
const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) })

export const api = {
  me: () => request<Me>("/me"),
  rename: (display_name: string) => request<Me>("/me", { method: "PATCH", body: JSON.stringify({ display_name }) }),
  checkout: (interval: "month" | "year") => request<Me>("/billing/checkout", post({ plan: "pro", interval })),
  cancel: () => request<Me>("/billing/cancel", post({})),

  tracks: () => request<Track[]>("/tracks"),
  courses: () => request<Course[]>("/courses"),
  library: () => request<Library>("/library"),
  playgroundSchema: () => request<PlaygroundSchema>("/playground/schema"),
  runSql: (sql: string) => request<PlaygroundResult>("/playground/sql", post({ sql })),
  course: (id: string) => request<Course>(`/courses/${enc(id)}`),
  lesson: (id: string) => request<LessonDetail>(`/lessons/${enc(id)}`),
  attemptQuiz: (id: string, answers: Record<string, number>) =>
    request<QuizAttemptResult>(`/lessons/${enc(id)}/attempts`, post({ answers })),

  exercise: (id: string) => request<ExerciseDetail>(`/exercises/${enc(id)}`),
  submissions: (id: string) => request<Submission[]>(`/exercises/${enc(id)}/submissions`),
  submit: (id: string, code: string) => request<SubmissionOut>(`/exercises/${enc(id)}/submissions`, post({ code })),
  solution: (id: string) => request<Solution>(`/exercises/${enc(id)}/solution`),

  progress: () => request<Progress>("/progress"),
  leaderboard: (period: LeaderboardPeriod) => request<Leaderboard>(`/leaderboard?period=${period}`),

  reviewCards: () => request<ReviewDeck>("/review/cards"),
  certificate: (courseId: string) => request<Certificate>(`/certificates/${enc(courseId)}`),
}
