"""The core of a DAG orchestrator: ordering, parallel layers and a runner with retries."""
import heapq


def topological_order(dag: dict[str, list[str]]) -> list[str]:
    """Every task after its upstreams; alphabetical among ready tasks. ValueError on cycles/unknown upstreams."""
    raise NotImplementedError


def execution_layers(dag: dict[str, list[str]]) -> list[list[str]]:
    """Groups of tasks that can run in parallel, in order."""
    raise NotImplementedError


def run_dag(dag: dict[str, list[str]], runners: dict, max_retries: int = 2) -> dict[str, dict]:
    """Run the DAG; return {task: {'state': 'success'|'failed'|'upstream_failed', 'attempts': n}}."""
    raise NotImplementedError
