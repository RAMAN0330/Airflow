# Control plane + grader. Build from the repo root:
#   docker build -f api/Dockerfile -t gradient-api .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/data/platform.db

RUN useradd --create-home --uid 10001 app && mkdir /data && chown app /data
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY grader grader
COPY api api
COPY exercises exercises
COPY lessons lessons

USER app
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"
# Single worker: the per-user run lock and the run semaphore are in-process.
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
