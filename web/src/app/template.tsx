// Re-mounted on every navigation, so each page eases in. Pure CSS, so server-rendered
// content is visible even before hydration (and the animation is skipped for reduced motion).
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="enter flex flex-1 flex-col" style={{ "--enter-y": "10px", animationDuration: "0.4s" } as React.CSSProperties}>
      {children}
    </div>
  )
}
