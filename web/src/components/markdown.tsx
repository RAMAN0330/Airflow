import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-task">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
