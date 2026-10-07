import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export const FAQ_ITEMS = [
  {
    q: "What do I need to know before starting?",
    a: "Comfortable Python and basic NumPy (arrays, shapes, matrix multiplication). The Math & Statistics track covers the foundations, and every lesson introduces the math it needs as it goes.",
  },
  {
    q: "How is my code graded?",
    a: "Every run executes in an isolated, resource-limited sandbox against a hidden test suite. The tests check properties of a correct implementation: shapes, gradients against finite differences, convergence, numerical stability and masking. Any correct approach passes, and common mistakes each fail a specific test with a hint.",
  },
  {
    q: "Why do lessons and courses unlock in order?",
    a: "Each step builds on the one before it. You pass a short quiz on a lesson before writing its code, and you finish a course before the next course in the same track opens. Tracks are independent, so you can work on Math & Statistics, Data Engineering and Machine Learning at the same time.",
  },
  {
    q: "Where does the material come from?",
    a: "Every lesson cites its primary sources: original papers (Codd's relational model, Attention Is All You Need, Hidden Technical Debt in ML Systems…), official documentation (SQLite, PostgreSQL, dbt, Airflow, MLflow, Feast) and standard textbooks. They're all collected in the Library.",
  },
  {
    q: "What's included for free?",
    a: "Every free course, including all of its lessons, quizzes and graded exercises, plus the SQL Playground, the Library and the leaderboard. Courses marked Pro, such as Generative AI & LLMs and MLOps, need a Pro plan. The Learn page and the pricing page show which is which.",
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
