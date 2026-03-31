from __future__ import annotations

from dataclasses import asdict, dataclass

import pandas as pd

from inference.config import DatasetConfig


@dataclass(slots=True)
class DatasetQualitySummary:
    rows_evaluated: int
    missing_actual_item_ratio: float
    gold_incoherent_ratio: float
    unknown_role_ratio: float
    candidate_pool_min: int
    candidate_pool_median: float
    candidate_pool_p95: float

    def to_report_payload(self) -> dict[str, float | int]:
        return asdict(self)


def build_quality_summary(
    frame: pd.DataFrame,
    *,
    missing_actual_item_count: int,
    gold_incoherent_count: int,
) -> DatasetQualitySummary:
    rows_evaluated = len(frame)
    if rows_evaluated == 0:
        return DatasetQualitySummary(
            rows_evaluated=0,
            missing_actual_item_ratio=0.0,
            gold_incoherent_ratio=0.0,
            unknown_role_ratio=0.0,
            candidate_pool_min=0,
            candidate_pool_median=0.0,
            candidate_pool_p95=0.0,
        )

    candidate_pool_sizes = frame["candidate_pool_size"].astype(int)
    return DatasetQualitySummary(
        rows_evaluated=rows_evaluated,
        missing_actual_item_ratio=missing_actual_item_count / rows_evaluated,
        gold_incoherent_ratio=gold_incoherent_count / rows_evaluated,
        unknown_role_ratio=float((frame["role"] == "UNKNOWN").mean()),
        candidate_pool_min=int(candidate_pool_sizes.min()),
        candidate_pool_median=float(candidate_pool_sizes.median()),
        candidate_pool_p95=float(candidate_pool_sizes.quantile(0.95)),
    )


def validate_quality_gates(summary: DatasetQualitySummary, config: DatasetConfig) -> None:
    failures: list[str] = []

    if summary.missing_actual_item_ratio > config.max_missing_actual_item_ratio:
        failures.append(
            "missing actual item ratio exceeded: "
            f"{summary.missing_actual_item_ratio:.3f} > {config.max_missing_actual_item_ratio:.3f}"
        )
    if summary.gold_incoherent_ratio > config.max_gold_incoherent_ratio:
        failures.append(
            "gold incoherent ratio exceeded: "
            f"{summary.gold_incoherent_ratio:.3f} > {config.max_gold_incoherent_ratio:.3f}"
        )
    if summary.unknown_role_ratio > config.max_unknown_role_ratio:
        failures.append(
            "unknown role ratio exceeded: "
            f"{summary.unknown_role_ratio:.3f} > {config.max_unknown_role_ratio:.3f}"
        )
    if summary.candidate_pool_median < config.min_candidate_pool_median:
        failures.append(
            "candidate pool median below threshold: "
            f"{summary.candidate_pool_median:.2f} < {config.min_candidate_pool_median:.2f}"
        )

    if failures:
        raise ValueError("; ".join(failures))
