import { useUserStore } from "@/stores/user-store"
import type { Curriculum, ExerciseDetail, Progress, Submission, SubmissionOut } from "@/lib/types"

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

export const api = {
  curriculum: () => request<Curriculum>("/curriculum"),
  exercise: (id: string) => request<ExerciseDetail>(`/exercises/${encodeURIComponent(id)}`),
  submissions: (id: string) => request<Submission[]>(`/exercises/${encodeURIComponent(id)}/submissions`),
  submit: (id: string, code: string) =>
    request<SubmissionOut>(`/exercises/${encodeURIComponent(id)}/submissions`, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  progress: () => request<Progress>("/progress"),
}
