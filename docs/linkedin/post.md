# LinkedIn post: Gradient demo

Assets in this folder:

| File | Use |
| --- | --- |
| `gradient-demo.mp4` | Upload as the post video (1920×1080, 30 fps, about 98 s, H.264, captions burned in) |
| `captions.srt` | Optional: on the video upload screen, under **Edit → Captions**, add this file for accessible captions |
| `cover-1920x1080.png` | Video thumbnail (on the upload screen, under **Edit → Thumbnail**) |
| `cover-1200x627.png` | Link-preview size, for an image-only post or an article header |

Character count of the post body below: about 1,900 (the LinkedIn limit is 3,000). The first two lines are what shows before "…see more".

---

## Post (copy from here)

Most ML courses let you watch someone else write the gradient descent loop.

I built a platform where you write it yourself, and hidden tests tell you exactly what's wrong. 🧵👇

Meet **Gradient**: a hands-on learning platform for Machine Learning, Data Engineering and MLOps.

How it works:
📖 Read a short lesson (key takeaways, an animated step-by-step flow, and cited primary sources)
✅ Pass a quick quiz to unlock the exercise
💻 Implement the real thing in the browser: SQL analytics, an ETL pipeline, a DAG scheduler, drift detection, a point-in-time feature join, self-attention…
🧪 Hit Run: your code is graded in a sandbox against hidden pytest suites, with a targeted hint for every failing test
🔓 Finish a course, and the next one unlocks

What's inside today:
• 3 tracks · 6 courses · 11 lessons · 11 graded exercises
• 108 hidden tests, each with its own hint
• A SQL Playground on a real shop database, where you can watch EXPLAIN QUERY PLAN flip from SCAN to SEARCH after you add an index
• A library of 37 trusted sources (Codd 1970, "Attention Is All You Need", Google's "Hidden Technical Debt in ML Systems", the official PostgreSQL, SQLite and Airflow docs…) plus a 57-term glossary, each entry linked to the lesson that teaches it
• XP, a progress dashboard with an activity heatmap, and a leaderboard

Under the hood:
⚙️ Next.js 16 + React 19, shadcn/ui, Zustand, Motion
⚙️ FastAPI + SQLite, with sequential unlocking rules enforced on the server
⚙️ A sandboxed grader: separate process, CPU/memory/file-size limits, wall-clock kill, structured JSON results
⚙️ 66 backend tests, including bug-injection tests that prove every exercise's suite catches common mistakes

The idea I keep coming back to: you don't understand attention, idempotent loads or train/serve skew until you've written them and watched a test fail.

The video shows the full journey: a lesson, the quiz, writing SQL, 7/7 tests passing, a course unlocking, the playground, the library and the leaderboard.

I'd love feedback, especially from data and ML engineers: which concept should get an exercise next? 👇

🔗 Code: https://github.com/raman0330/airflow

#MachineLearning #DataEngineering #MLOps #SQL #Python #NextJS #FastAPI #EdTech #BuildInPublic #LearnByDoing

---

### Optional variations

**Shorter hook (A/B option):**
> Reading about self-attention ≠ understanding it.
> So I built a platform where hidden tests grade your implementation. 👇

**If you want to credit tooling, add before the hashtags:**
> Built with Claude Code as my pair programmer.

**First comment (post it yourself right after publishing, so links stay out of the main body):**
> Repo + setup (one `docker compose up`): https://github.com/raman0330/airflow
> Tracks: Machine Learning (classical ML → deep learning → GenAI), Data Engineering (Databases & SQL → ETL/ELT pipelines), MLOps (registry, drift, feature stores).
