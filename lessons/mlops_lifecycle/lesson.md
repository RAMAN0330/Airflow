# The MLOps Lifecycle: Tracking, Registry & Promotion

Training a good model is the visible part of ML. Sculley et al.'s *Hidden Technical Debt in Machine
Learning Systems* (NeurIPS 2015) famously showed that in real systems the model code is a **small box
surrounded by much larger infrastructure**: data collection, feature extraction, configuration, serving and
monitoring. Debt builds up in that infrastructure: glue code, pipeline jungles, undeclared consumers and
entangled features, where changing anything changes everything.

**MLOps** applies DevOps discipline to that whole system. Google's MLOps guide describes maturity levels
from manual, notebook-driven work (level 0), through automated training pipelines (level 1), to automated
CI/CD of the pipelines themselves (level 2). This lesson covers the two practices you need first.

## 1. Experiment tracking

Every training run should record:

- **parameters**: learning rate, depth, feature set, data snapshot id;
- **metrics**: AUC, loss, latency;
- **lineage**: the code version and data that produced it.

MLflow Tracking, for example, organizes this as **runs** with logged params and metrics. Store copies,
because history must never change after the fact.

### Reproducibility fingerprints

Two runs with the same configuration should be recognizable as the same experiment. Hash a **canonical**
serialization of the params, with sorted keys and fixed separators, so `{"lr": 0.1, "d": 3}` and
`{"d": 3, "lr": 0.1}` produce the same SHA-256. Fingerprints catch accidental repeats and make
"which config produced this?" a single lookup.

## 2. Choosing the best run, deterministically

`best_run("auc", mode="max")` sounds trivial until you hit ties and missing metrics. Decide the rules up
front: skip runs without the metric, and break ties by the earliest run. Then two people asking the same
question get the same answer.

## 3. The model registry

A **registry** turns "the pickle in Dana's home directory" into a managed asset:

| Concept | Meaning |
|---|---|
| Registered model | A stable name, e.g. `churn` |
| Version | `churn` v1, v2, v3… each linked to the run that produced it |
| Stage | `None` → `Staging` → `Production` → `Archived` |

Classic MLflow used these stage names. Newer MLflow versions replace stages with **aliases** (mutable
pointers like `@champion`) that serve the same purpose. The invariant is what matters:

> **Exactly one version answers to "production" at any time.**

Promoting v3 therefore *archives* the old production version, so v2 and v3 can never serve
simultaneously by accident.

## 4. Rollback is a feature

New versions sometimes regress in ways offline metrics missed. Keep a **promotion history** so rollback is
one call: restore the previous production version and archive the bad one. The best time to build rollback
is before you need it.

## Where this leads

With tracked runs and a registry in place, you can automate the loop: continuous training on new data,
validation gates before Staging, canary releases into Production, and monitoring that triggers
retraining. That monitoring is the next lesson.
