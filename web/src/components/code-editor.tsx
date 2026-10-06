"use client"

import { useEffect, useRef } from "react"
import Editor, { loader, type OnMount } from "@monaco-editor/react"
import { useTheme } from "next-themes"

import { Skeleton } from "@/components/ui/skeleton"
import { useEditorStore } from "@/stores/editor-store"

// Monaco is served from /public (copied by scripts/copy-monaco.mjs), so the
// editor works without a third-party CDN.
loader.config({ paths: { vs: "/monaco/vs" } })

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  readOnly?: boolean
  language?: "python" | "sql"
}

export function CodeEditor({ value, onChange, onRun, readOnly, language = "python" }: CodeEditorProps) {
  const { resolvedTheme } = useTheme()
  const fontSize = useEditorStore((s) => s.fontSize)
  const minimap = useEditorStore((s) => s.minimap)
  const onRunRef = useRef(onRun)

  useEffect(() => {
    onRunRef.current = onRun
  }, [onRun])

  const handleMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current())
    editor.focus()
  }

  return (
    <Editor
      language={language}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
      loading={<Skeleton className="m-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]" />}
      options={{
        fontSize,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontLigatures: true,
        minimap: { enabled: minimap },
        readOnly,
        scrollBeyondLastLine: false,
        tabSize: language === "sql" ? 2 : 4,
        insertSpaces: true,
        renderLineHighlight: "all",
        smoothScrolling: true,
        padding: { top: 12, bottom: 12 },
        automaticLayout: true,
        bracketPairColorization: { enabled: true },
      }}
    />
  )
}
