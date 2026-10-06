"""Reference solution — never shipped to learners."""
import heapq


def _validate(dag):
    for task, ups in dag.items():
        for u in ups:
            if u not in dag:
                raise ValueError(f"{task!r} depends on unknown task {u!r}")


def _downstream(dag):
    down = {t: [] for t in dag}
    for t, ups in dag.items():
        for u in ups:
            down[u].append(t)
    return down


def topological_order(dag):
    _validate(dag)
    pending = {t: len(set(ups)) for t, ups in dag.items()}
    down = _downstream(dag)
    ready = [t for t, n in pending.items() if n == 0]
    heapq.heapify(ready)
    order = []
    while ready:
        t = heapq.heappop(ready)
        order.append(t)
        for d in down[t]:
            pending[d] -= 1
            if pending[d] == 0:
                heapq.heappush(ready, d)
    if len(order) != len(dag):
        raise ValueError(f"cycle detected among: {sorted(set(dag) - set(order))}")
    return order


def execution_layers(dag):
    order = topological_order(dag)
    level = {}
    for t in order:
        level[t] = 1 + max((level[u] for u in dag[t]), default=-1)
    layers = [[] for _ in range(max(level.values(), default=-1) + 1)]
    for t, lv in level.items():
        layers[lv].append(t)
    return [sorted(layer) for layer in layers]


def run_dag(dag, runners, max_retries=2):
    result = {}
    for t in topological_order(dag):
        if any(result[u]["state"] != "success" for u in dag[t]):
            result[t] = {"state": "upstream_failed", "attempts": 0}
            continue
        attempts, ok = 0, False
        while attempts <= max_retries and not ok:
            attempts += 1
            try:
                runners[t]()
                ok = True
            except Exception:
                ok = False
        result[t] = {"state": "success" if ok else "failed", "attempts": attempts}
    return result
