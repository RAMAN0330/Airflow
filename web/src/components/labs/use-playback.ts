"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * A step counter with play/pause. Nothing autoplays: playback only starts when the
 * learner presses play, which keeps the labs calm under prefers-reduced-motion.
 */
export function usePlayback({ length, interval = 60, stride = 1 }: { length: number; interval?: number; stride?: number }) {
  const [rawT, setT] = useState(0)
  const [wantPlay, setWantPlay] = useState(false)
  const t = Math.min(rawT, length)
  const done = t >= length
  const playing = wantPlay && !done

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((p) => Math.min(p + stride, length)), interval)
    return () => clearInterval(id)
  }, [playing, interval, stride, length])

  const toggle = useCallback(() => {
    if (playing) {
      setWantPlay(false)
      return
    }
    if (done) setT(0)
    setWantPlay(true)
  }, [playing, done])

  const step = useCallback(
    (n = stride) => {
      setWantPlay(false)
      setT((p) => Math.min(Math.min(p, length) + n, length))
    },
    [stride, length]
  )

  const reset = useCallback(() => {
    setWantPlay(false)
    setT(0)
  }, [])

  const seek = useCallback((v: number) => {
    setWantPlay(false)
    setT(v)
  }, [])

  return { t, playing, done, toggle, step, reset, seek }
}
