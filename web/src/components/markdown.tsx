import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { slugify } from "@/lib/slug"

function text(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children)
  if (Array.isArray(children)) return children.map(text).join("")
  if (children && typeof children === "object" && "props" in children) {
    return text((children as { props: { children?: React.ReactNode } }).props.children)
  }
  return ""
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-task">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Stable ids on section headings power the "On this page" navigation.
          h2: ({ children: c }) => (
            <h2 id={slugify(text(c))} className="scroll-mt-24">
              {c}
            </h2>
          ),
          a: ({ href, children: c }) => (
            <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
