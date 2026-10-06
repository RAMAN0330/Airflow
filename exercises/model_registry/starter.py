"""Experiment tracking + a model registry with stages and rollback."""
import copy
import hashlib
import json

STAGES = ("None", "Staging", "Production", "Archived")


class ModelRegistry:
    def __init__(self):
        # TODO: storage for runs and model versions
        pass

    # --- tracking ---------------------------------------------------------
    def log_run(self, params: dict, metrics: dict) -> str:
        raise NotImplementedError

    def get_run(self, run_id: str) -> dict:
        raise NotImplementedError

    @staticmethod
    def fingerprint(params: dict) -> str:
        raise NotImplementedError

    def duplicate_runs(self) -> list[list[str]]:
        raise NotImplementedError

    def best_run(self, metric: str, mode: str = "max") -> str:
        raise NotImplementedError

    # --- registry ---------------------------------------------------------
    def register(self, run_id: str, name: str) -> int:
        raise NotImplementedError

    def stage(self, name: str, version: int) -> str:
        raise NotImplementedError

    def transition(self, name: str, version: int, stage: str) -> None:
        raise NotImplementedError

    def get_production(self, name: str):
        raise NotImplementedError

    def rollback(self, name: str) -> int:
        raise NotImplementedError
