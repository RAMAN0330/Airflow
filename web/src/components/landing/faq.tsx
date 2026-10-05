import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export const FAQ_ITEMS = [
  {
    q: "What do I need to know before starting?",
    a: "Comfortable Python and basic NumPy (arrays, shapes, matrix multiplication). The lessons cover the math you need as you go, starting from derivatives of a simple loss.",
  },
  {
    q: "How is my code graded?",
    a: "Every run executes in an isolated, resource-limited sandbox against a hidden test suite. The tests check properties of a correct implementation: shapes, gradients against finite differences, convergence, numerical stability and masking. Any correct approach passes, and common mistakes each fail a specific test with a hint.",
  },
  {
    q: "Why do lessons and courses unlock in order?",
    a: "Each step builds on the one before it. You pass a short quiz on a lesson before writing its code, and you finish a course before the next one opens. That keeps the path from getting ahead of the fundamentals.",
  },
  {
    q: "What's included for free?",
    a: "The Classical Machine Learning and Deep Learning Foundations courses, every lesson and quiz in them, sandboxed grading, hints and the leaderboard. Pro adds the Generative AI & LLMs course and future Pro courses.",
  },
  {
    q: "Can I cancel Pro at any time?",
    a: "Yes. You keep everything you've completed. Pro-only courses simply lock again until you resubscribe.",
  },
]

export function Faq({ items = FAQ_ITEMS }: { items?: typeof FAQ_ITEMS }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((item) => (
        <AccordionItem key={item.q} value={item.q}>
          <AccordionTrigger className="text-base">{item.q}</AccordionTrigger>
          <AccordionContent className="leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
