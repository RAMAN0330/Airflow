"""Reference solution — never shipped to learners."""
import copy
import hashlib
import json

STAGES = ("None", "Staging", "Production", "Archived")


class ModelRegistry:
    def __init__(self):
        self._runs = {}
        self._order = []
        self._models = {}  # name -> {version: {"run_id", "stage"}}
        self._prod_history = {}  # name -> [versions that were Production, oldest first]

    def log_run(self, params, metrics):
        run_id = f"run-{len(self._order) + 1}"
        self._runs[run_id] = {
            "run_id": run_id,
            "params": copy.deepcopy(params),
            "metrics": copy.deepcopy(metrics),
            "fingerprint": self.fingerprint(params),
        }
        self._order.append(run_id)
        return run_id

    def get_run(self, run_id):
        return copy.deepcopy(self._runs[run_id])

    @staticmethod
    def fingerprint(params):
        canonical = json.dumps(params, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(canonical.encode()).hexdigest()

    def duplicate_runs(self):
        groups = {}
        for rid in self._order:
            groups.setdefault(self._runs[rid]["fingerprint"], []).append(rid)
        return [g for g in groups.values() if len(g) > 1]

    def best_run(self, metric, mode="max"):
        if mode not in ("max", "min"):
            raise ValueError("mode must be 'max' or 'min'")
        best = None
        for rid in self._order:
            value = self._runs[rid]["metrics"].get(metric)
            if value is None:
                continue
            if best is None or (value > best[1] if mode == "max" else value < best[1]):
                best = (rid, value)
        if best is None:
            raise ValueError(f"no run has metric {metric!r}")
        return best[0]

    def register(self, run_id, name):
        if run_id not in self._runs:
            raise KeyError(run_id)
        versions = self._models.setdefault(name, {})
        version = len(versions) + 1
        versions[version] = {"run_id": run_id, "stage": "None"}
        return version

    def _version(self, name, version):
        if name not in self._models or version not in self._models[name]:
            raise KeyError(f"{name} v{version}")
        return self._models[name][version]

    def stage(self, name, version):
        return self._version(name, version)["stage"]

    def transition(self, name, version, stage):
        if stage not in STAGES:
            raise ValueError(f"unknown stage {stage!r}")
        entry = self._version(name, version)
        if stage == "Production":
            current = self.get_production(name)
            if current is not None and current != version:
                self._models[name][current]["stage"] = "Archived"
            if current != version:
                self._prod_history.setdefault(name, []).append(version)
        entry["stage"] = stage

    def get_production(self, name):
        if name not in self._models:
            raise KeyError(name)
        return next((v for v, e in self._models[name].items() if e["stage"] == "Production"), None)

    def rollback(self, name):
        history = self._prod_history.get(name, [])
        current = self.get_production(name)
        previous = [v for v in history if v != current]
        if not previous:
            raise ValueError(f"no previous Production version of {name!r}")
        target = previous[-1]
        if current is not None:
            self._models[name][current]["stage"] = "Archived"
            history.remove(current)
        self._models[name][target]["stage"] = "Production"
        return target
