# LinkedIn post: Gradient demo

Assets in this folder:

| File | Use |
| --- | --- |
| `gradient-demo.mp4` | Upload as the post video (1920×1080, 30 fps, about 98 s, H.264, captions burned in) |
| `captions.srt` | Optional: on the video upload screen, under **Edit → Captions**, add this file for accessible captions |
| `cover-1920x1080.png` | Video thumbnail (on the upload screen, under **Edit → Thumbnail**) |
| `cover-1200x627.png` | Link-preview size, for an image-only post or an article header |

The main post below is written in a conversational first-person voice (about 1,900 characters; LinkedIn allows 3,000). The opening two lines are what shows before "…see more". A punchier feature-list version follows it.

---

## Post (copy from here)

I used to think I understood attention.

Then I tried to write it from scratch, and got the shapes wrong three times before anything ran.

That's the gap I wanted to close. Watching someone explain gradient descent feels like learning. Writing it, hitting Run, and seeing a test fail with "your loss went up, check the sign of your update" is when it actually sticks.

So I built Gradient, a small learning platform for ML, data engineering and MLOps where you learn by building every piece yourself.

Each step is simple: read a short lesson, pass a quick quiz, then write the real thing in the browser. Your code runs in a sandbox against hidden tests, and every failing test comes with a hint instead of just a red X. Finish a course and the next one unlocks.

Right now there are 11 lessons and 11 exercises across 3 tracks. You write SQL analytics queries, an ETL pipeline, a little DAG scheduler, drift detection, a point-in-time feature join and a self-attention head. There's also a SQL playground where you can add an index and watch the query plan change from a full scan to an index search. That moment never gets old for me.

I didn't want to invent explanations, so every lesson links back to where the ideas come from: Codd's 1970 relational paper, "Attention Is All You Need", Google's "Hidden Technical Debt in ML Systems", and the official Postgres, SQLite and Airflow docs. 37 sources in total.

For the curious, it's Next.js, shadcn/ui and Zustand on the front, FastAPI and SQLite on the back, and a sandboxed pytest grader doing the judging.

It's early, and I'm sure there's plenty to improve. If you work with data or ML, I'd really like to know: which concept do you wish you'd had to build yourself when you were learning?

Code's here if you want to poke around: https://github.com/raman0330/airflow

#MachineLearning #DataEngineering #MLOps #LearnByDoing #BuildInPublic

---

## Alternative: feature-list version

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
