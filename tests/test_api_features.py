"""API tests for learning features: review cards, reference solutions, certificates and streaks.

Steps are discovered from /api/courses so these tests survive curriculum changes.
"""
from datetime import date

import pytest

from api.progression import streaks
from tests.test_api import H, H2, client, pass_exercise, pass_lesson  # noqa: F401  (client is a fixture)


def course_steps(course: dict) -> list[dict]:
    return [m[kind] for m in course["modules"] for kind in ("lesson", "exercise") if m[kind]]


def first_course(client, *, need_exercise: bool = False) -> dict:
    """The smallest free, initially-available course (optionally one that has an exercise)."""
    courses = [c for c in client.get("/api/courses", headers=H).json()
               if c["status"] == "available" and c["tier"] == "free" and c["total_steps"]]
    if need_exercise:
        courses = [c for c in courses if any(s["kind"] == "exercise" for s in course_steps(c))]
    if not courses:
        pytest.skip("no suitable free course in the curriculum")
    return min(courses, key=lambda c: c["total_steps"])


def complete_steps(client, steps: list[dict], headers=H):
    for s in steps:
        if s["kind"] == "lesson":
            pass_lesson(client, s["id"], headers)
        else:
            pass_exercise(client, s["id"], headers)


# ------------------------------------------------------------------ review

def test_review_cards_only_for_completed_lessons(client):
    assert client.get("/api/review/cards", headers=H).json() == {"terms": [], "questions": []}

    course = first_course(client)
    lesson = next(s for s in course_steps(course) if s["kind"] == "lesson")
    pass_lesson(client, lesson["id"])

    deck = client.get("/api/review/cards", headers=H).json()
    assert deck["questions"], "a passed lesson's quiz questions become cards"
    for q in deck["questions"]:
        assert q["lesson"]["id"] == lesson["id"]
        assert 0 <= q["answer"] < len(q["options"])
        assert q["id"].startswith(f"quiz:{lesson['id']}:")
    assert all(t["lesson"]["id"] == lesson["id"] for t in deck["terms"])
    assert len({c["id"] for c in deck["terms"] + deck["questions"]}) == len(deck["terms"]) + len(deck["questions"])

    # Another learner's deck stays empty: answers are never leaked for unpassed lessons.
    assert client.get("/api/review/cards", headers=H2).json() == {"terms": [], "questions": []}


# ------------------------------------------------------------------ solutions

def test_solution_requires_a_passing_submission(client):
    course = first_course(client, need_exercise=True)
    steps = course_steps(course)
    idx = next(i for i, s in enumerate(steps) if s["kind"] == "exercise")
    eid = steps[idx]["id"]

    assert client.get(f"/api/exercises/{eid}/solution", headers=H).status_code == 403
    assert client.get("/api/exercises/does_not_exist/solution", headers=H).status_code == 404

    complete_steps(client, steps[:idx])
    # A failing attempt does not unlock it.
    r = client.post(f"/api/exercises/{eid}/submissions", headers=H, json={"code": "x = 1\n"})
    assert r.status_code == 201 and r.json()["status"] != "passed"
    assert client.get(f"/api/exercises/{eid}/solution", headers=H).status_code == 403

    pass_exercise(client, eid)
    sol = client.get(f"/api/exercises/{eid}/solution", headers=H).json()
    assert sol["exercise_id"] == eid and sol["code"].strip()
    assert not sol["code"].lstrip().startswith('"""Reference solution')
    assert sol["your_code"] and sol["your_code"].strip()
    assert client.get(f"/api/exercises/{eid}/solution", headers=H2).status_code == 403


# ------------------------------------------------------------------ certificates

def test_certificate_requires_completed_course(client):
    course = first_course(client)
    cid = course["id"]
    assert client.get(f"/api/certificates/{cid}", headers=H).status_code == 403
    assert client.get("/api/certificates/nope", headers=H).status_code == 404

    client.patch("/api/me", headers=H, json={"display_name": "Ada Lovelace"})
    steps = course_steps(course)
    complete_steps(client, steps)

    cert = client.get(f"/api/certificates/{cid}", headers=H).json()
    assert cert["display_name"] == "Ada Lovelace"
    assert cert["course_title"] == course["title"] and cert["track_id"] == course["track_id"]
    assert cert["total_xp"] == course["total_xp"]
    assert cert["lessons"] == sum(s["kind"] == "lesson" for s in steps)
    assert cert["exercises"] == sum(s["kind"] == "exercise" for s in steps)
    assert cert["completed_at"][:4].isdigit()
    assert len(cert["id"]) == 19 and cert["id"].count("-") == 3
    # Deterministic per learner + course.
    assert client.get(f"/api/certificates/{cid}", headers=H).json()["id"] == cert["id"]
    assert client.get(f"/api/certificates/{cid}", headers=H2).status_code == 403


# ------------------------------------------------------------------ streaks

def test_streak_math():
    d = date(2026, 10, 7)
    assert streaks([], d) == (0, 0)
    assert streaks(["2026-10-07"], d) == (1, 1)
    assert streaks(["2026-10-05", "2026-10-06"], d) == (2, 2), "yesterday keeps the streak alive"
    assert streaks(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05"], d) == (0, 3)
    assert streaks(["2026-10-01", "2026-10-02", "2026-10-06", "2026-10-07", "2026-10-07"], d) == (2, 2)


def test_progress_and_me_report_streaks(client):
    p = client.get("/api/progress", headers=H).json()
    assert (p["current_streak"], p["longest_streak"]) == (0, 0)
    assert client.get("/api/me", headers=H).json()["current_streak"] == 0

    lesson = next(s for s in course_steps(first_course(client)) if s["kind"] == "lesson")
    pass_lesson(client, lesson["id"])
    p = client.get("/api/progress", headers=H).json()
    assert (p["current_streak"], p["longest_streak"]) == (1, 1)
    assert client.get("/api/me", headers=H).json()["current_streak"] == 1
