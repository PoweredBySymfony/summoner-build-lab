from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from math import log2
from typing import Any

import pandas as pd
from sklearn.feature_extraction import DictVectorizer
from xgboost import XGBRanker

from inference.config import AppConfig, load_config
from models.artifacts import save_metadata, save_model
from models.feature_builder import build_ranking_feature_dict


@dataclass(slots=True)
class RankingTrainingSummary:
    model_family: str
    train_rows: int
    validation_rows: int
    test_rows: int
    train_queries: int
    validation_queries: int
    test_queries: int
    unique_candidate_items: int
    ndcg_at_k: float
    map_at_k: float
    top1_accuracy: float
    topk_accuracy: float
    model_path: str
    metadata_path: str
    evaluation_report_path: str


def _load_frame(path: Any) -> pd.DataFrame:
    frame = pd.read_parquet(path)
    if "current_items" in frame.columns:
        frame["current_items"] = frame["current_items"].apply(
            lambda value: value if isinstance(value, list) else []
        )
    if "item_tags" in frame.columns:
        frame["item_tags"] = frame["item_tags"].apply(
            lambda value: value if isinstance(value, list) else []
        )
    return frame


def _filter_ranking_frame(frame: pd.DataFrame, *, min_candidate_frequency: int) -> pd.DataFrame:
    counts = frame.groupby("candidate_item_slug")["label"].sum()
    allowed = counts[counts >= min_candidate_frequency].index
    filtered = frame[frame["candidate_item_slug"].isin(allowed)].copy()
    positive_queries = filtered.groupby("snapshot_id")["label"].sum()
    positive_snapshot_ids = positive_queries[positive_queries > 0].index
    return filtered[filtered["snapshot_id"].isin(positive_snapshot_ids)].copy()


def _build_group_sizes(frame: pd.DataFrame) -> list[int]:
    grouped = frame.groupby("snapshot_id", sort=False).size()
    return [int(value) for value in grouped.astype(int).tolist()]


def _vectorize_ranking_frame(
    frame: pd.DataFrame,
    *,
    vectorizer: DictVectorizer | None = None,
) -> tuple[Any, Any, DictVectorizer]:
    feature_rows = [build_ranking_feature_dict(row) for row in frame.to_dict(orient="records")]
    active_vectorizer = vectorizer or DictVectorizer(sparse=True)
    matrix = (
        active_vectorizer.fit_transform(feature_rows)
        if vectorizer is None
        else active_vectorizer.transform(feature_rows)
    )
    labels = frame["label"].astype(int).to_numpy()
    return matrix, labels, active_vectorizer


def _group_rank_positions(frame: pd.DataFrame, scores: list[float]) -> list[int]:
    scored = frame[["snapshot_id", "label"]].copy()
    scored["score"] = scores
    positions: list[int] = []
    for _snapshot_id, group in scored.groupby("snapshot_id", sort=False):
        ordered = group.sort_values("score", ascending=False).reset_index(drop=True)
        positive_positions = ordered.index[ordered["label"] == 1].tolist()
        if positive_positions:
            positions.append(int(positive_positions[0]) + 1)
    return positions


def _topk_accuracy(rank_positions: list[int], k: int) -> float:
    if not rank_positions:
        return 0.0
    return sum(1 for position in rank_positions if position <= k) / len(rank_positions)


def _map_at_k(rank_positions: list[int], k: int) -> float:
    if not rank_positions:
        return 0.0
    scores = [1.0 / position if position <= k else 0.0 for position in rank_positions]
    return sum(scores) / len(scores)


def _ndcg_at_k(rank_positions: list[int], k: int) -> float:
    if not rank_positions:
        return 0.0
    scores = [1.0 / log2(position + 1) if position <= k else 0.0 for position in rank_positions]
    return sum(scores) / len(scores)


def train_ranking_model(config: AppConfig) -> RankingTrainingSummary:
    ranking_frame = _load_frame(config.paths.ranking_dataset_path)
    train_snapshots = set(_load_frame(config.paths.train_dataset_path)["snapshot_id"].tolist())
    validation_snapshots = set(
        _load_frame(config.paths.validation_dataset_path)["snapshot_id"].tolist()
    )
    test_snapshots = set(_load_frame(config.paths.test_dataset_path)["snapshot_id"].tolist())

    train_frame = ranking_frame[ranking_frame["snapshot_id"].isin(train_snapshots)].copy()
    validation_frame = ranking_frame[ranking_frame["snapshot_id"].isin(validation_snapshots)].copy()
    test_frame = ranking_frame[ranking_frame["snapshot_id"].isin(test_snapshots)].copy()

    train_frame = _filter_ranking_frame(
        train_frame,
        min_candidate_frequency=config.dataset.min_train_label_frequency,
    )
    allowed_candidates = set(train_frame["candidate_item_slug"].tolist())
    validation_frame = validation_frame[
        validation_frame["candidate_item_slug"].isin(allowed_candidates)
        & validation_frame["snapshot_id"].isin(
            validation_frame.groupby("snapshot_id")["label"]
            .sum()
            .loc[lambda series: series > 0]
            .index
        )
    ].copy()
    test_frame = test_frame[
        test_frame["candidate_item_slug"].isin(allowed_candidates)
        & test_frame["snapshot_id"].isin(
            test_frame.groupby("snapshot_id")["label"].sum().loc[lambda series: series > 0].index
        )
    ].copy()

    if train_frame.empty or test_frame.empty:
        raise ValueError("Ranking train/test frames are empty after filtering.")

    x_train, y_train, vectorizer = _vectorize_ranking_frame(train_frame)
    x_validation, y_validation, _ = _vectorize_ranking_frame(
        validation_frame,
        vectorizer=vectorizer,
    )
    x_test, y_test, _ = _vectorize_ranking_frame(test_frame, vectorizer=vectorizer)

    train_group = _build_group_sizes(train_frame)
    validation_group = _build_group_sizes(validation_frame)

    model = XGBRanker(
        objective="rank:ndcg",
        n_estimators=config.training.xgboost_estimators,
        max_depth=config.training.xgboost_max_depth,
        learning_rate=config.training.xgboost_learning_rate,
        subsample=config.training.xgboost_subsample,
        colsample_bytree=config.training.xgboost_colsample_bytree,
        tree_method="hist",
        random_state=config.training.random_seed,
    )
    fit_kwargs: dict[str, Any] = {
        "group": train_group,
        "verbose": False,
    }
    if len(validation_frame) > 0 and validation_group:
        fit_kwargs["eval_set"] = [(x_validation, y_validation)]
        fit_kwargs["eval_group"] = [validation_group]
    model.fit(x_train, y_train, **fit_kwargs)

    test_scores = model.predict(x_test).tolist()
    top_k = min(config.training.top_k, config.training.max_top_k)
    rank_positions = _group_rank_positions(test_frame, test_scores)
    ndcg_at_k = _ndcg_at_k(rank_positions, top_k)
    map_at_k = _map_at_k(rank_positions, top_k)
    top1_accuracy = _topk_accuracy(rank_positions, 1)
    topk_accuracy = _topk_accuracy(rank_positions, top_k)

    trained_at = datetime.now(UTC).isoformat()
    bundle = {
        "model": model,
        "vectorizer": vectorizer,
        "model_family": "xgboost-rank-ndcg",
        "trained_at": trained_at,
    }
    save_model(config.paths.baseline_model_path, bundle)

    metadata = {
        "project": config.project.name,
        "version": config.project.version,
        "model_family": "xgboost-rank-ndcg",
        "trained_at": trained_at,
        "train_rows": len(train_frame),
        "validation_rows": len(validation_frame),
        "test_rows": len(test_frame),
        "train_queries": len(train_group),
        "validation_queries": len(validation_group),
        "test_queries": len(_build_group_sizes(test_frame)),
        "unique_candidate_items": int(train_frame["candidate_item_slug"].nunique()),
        "ndcg_at_k": float(ndcg_at_k),
        "map_at_k": float(map_at_k),
        "top1_accuracy": float(top1_accuracy),
        "topk_accuracy": float(topk_accuracy),
        "top_k": top_k,
        "candidate_items": sorted(allowed_candidates),
    }
    save_metadata(config.paths.baseline_metadata_path, metadata)
    save_metadata(config.paths.evaluation_metrics_path, metadata)

    report = "\n".join(
        [
            "# Next Item Ranking Evaluation",
            "",
            "- model family: `xgboost-rank-ndcg`",
            f"- trained at: `{trained_at}`",
            f"- train rows: `{len(train_frame)}`",
            f"- validation rows: `{len(validation_frame)}`",
            f"- test rows: `{len(test_frame)}`",
            f"- train queries: `{len(train_group)}`",
            f"- validation queries: `{len(validation_group)}`",
            f"- test queries: `{len(_build_group_sizes(test_frame))}`",
            f"- unique candidate items: `{train_frame['candidate_item_slug'].nunique()}`",
            f"- ndcg@{top_k}: `{ndcg_at_k:.4f}`",
            f"- map@{top_k}: `{map_at_k:.4f}`",
            f"- top-1 accuracy: `{top1_accuracy:.4f}`",
            f"- top-{top_k} accuracy: `{topk_accuracy:.4f}`",
        ]
    )
    config.paths.evaluation_report_path.parent.mkdir(parents=True, exist_ok=True)
    config.paths.evaluation_report_path.write_text(report, encoding="utf-8")

    return RankingTrainingSummary(
        model_family="xgboost-rank-ndcg",
        train_rows=len(train_frame),
        validation_rows=len(validation_frame),
        test_rows=len(test_frame),
        train_queries=len(train_group),
        validation_queries=len(validation_group),
        test_queries=len(_build_group_sizes(test_frame)),
        unique_candidate_items=int(train_frame["candidate_item_slug"].nunique()),
        ndcg_at_k=float(ndcg_at_k),
        map_at_k=float(map_at_k),
        top1_accuracy=float(top1_accuracy),
        topk_accuracy=float(topk_accuracy),
        model_path=str(config.paths.baseline_model_path),
        metadata_path=str(config.paths.baseline_metadata_path),
        evaluation_report_path=str(config.paths.evaluation_report_path),
    )


def main() -> None:
    summary = train_ranking_model(load_config())
    print(asdict(summary))


if __name__ == "__main__":
    main()
