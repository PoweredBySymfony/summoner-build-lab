from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.metrics import accuracy_score, top_k_accuracy_score
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

from inference.config import AppConfig, load_config
from models.artifacts import save_metadata, save_model
from models.feature_builder import build_feature_dict


@dataclass(slots=True)
class TrainingSummary:
    model_family: str
    train_rows: int
    validation_rows: int
    test_rows: int
    unique_labels: int
    top1_accuracy: float
    top3_accuracy: float
    mean_reciprocal_rank: float
    model_path: str
    metadata_path: str
    evaluation_report_path: str


def _load_split(path: Any) -> pd.DataFrame:
    frame = pd.read_parquet(path)
    frame["current_items"] = frame["current_items"].apply(
        lambda value: value if isinstance(value, list) else []
    )
    return frame


def _filter_labels(
    train_frame: pd.DataFrame,
    validation_frame: pd.DataFrame,
    test_frame: pd.DataFrame,
    *,
    min_frequency: int,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    label_counts = train_frame["actual_next_item"].value_counts()
    allowed_labels = label_counts[label_counts >= min_frequency].index
    filtered_train = train_frame[train_frame["actual_next_item"].isin(allowed_labels)].copy()
    filtered_validation = validation_frame[
        validation_frame["actual_next_item"].isin(allowed_labels)
    ].copy()
    filtered_test = test_frame[test_frame["actual_next_item"].isin(allowed_labels)].copy()
    return filtered_train, filtered_validation, filtered_test


def _to_features_and_labels(
    frame: pd.DataFrame,
    *,
    vectorizer: DictVectorizer | None = None,
    encoder: LabelEncoder | None = None,
) -> tuple[Any, Any, DictVectorizer, LabelEncoder]:
    feature_rows = [build_feature_dict(row) for row in frame.to_dict(orient="records")]
    active_vectorizer = vectorizer or DictVectorizer(sparse=True)
    matrix = (
        active_vectorizer.fit_transform(feature_rows)
        if vectorizer is None
        else active_vectorizer.transform(feature_rows)
    )

    active_encoder = encoder or LabelEncoder()
    labels = (
        active_encoder.fit_transform(frame["actual_next_item"].tolist())
        if encoder is None
        else active_encoder.transform(frame["actual_next_item"].tolist())
    )
    return matrix, labels, active_vectorizer, active_encoder


def _mean_reciprocal_rank(y_true: list[int], probabilities: list[list[float]]) -> float:
    total = 0.0
    for expected_label, row in zip(y_true, probabilities, strict=True):
        ordered = sorted(range(len(row)), key=lambda index: row[index], reverse=True)
        rank = ordered.index(expected_label) + 1
        total += 1.0 / rank
    return total / len(y_true) if y_true else 0.0


def train_baseline(config: AppConfig) -> TrainingSummary:
    train_frame = _load_split(config.paths.train_dataset_path)
    validation_frame = _load_split(config.paths.validation_dataset_path)
    test_frame = _load_split(config.paths.test_dataset_path)
    train_frame, validation_frame, test_frame = _filter_labels(
        train_frame,
        validation_frame,
        test_frame,
        min_frequency=config.dataset.min_train_label_frequency,
    )
    if train_frame.empty or test_frame.empty:
        raise ValueError("Training or test split is empty after frequency filtering.")
    if train_frame["actual_next_item"].nunique() < config.dataset.min_unique_labels:
        raise ValueError("Not enough unique labels remain after frequency filtering.")

    x_train, y_train, vectorizer, encoder = _to_features_and_labels(train_frame)
    x_validation, y_validation, _, _ = _to_features_and_labels(
        validation_frame, vectorizer=vectorizer, encoder=encoder
    )
    x_test, y_test, _, _ = _to_features_and_labels(
        test_frame, vectorizer=vectorizer, encoder=encoder
    )

    model_family = "xgboost"
    try:
        model = XGBClassifier(
            objective="multi:softprob",
            num_class=len(encoder.classes_),
            n_estimators=config.training.xgboost_estimators,
            max_depth=config.training.xgboost_max_depth,
            learning_rate=config.training.xgboost_learning_rate,
            subsample=config.training.xgboost_subsample,
            colsample_bytree=config.training.xgboost_colsample_bytree,
            eval_metric="mlogloss",
            tree_method="hist",
            random_state=config.training.random_seed,
        )
        eval_set = [(x_validation, y_validation)] if len(y_validation) else None
        model.fit(x_train, y_train, eval_set=eval_set, verbose=False)
    except Exception:
        model_family = "random-forest-fallback"
        model = RandomForestClassifier(
            n_estimators=220,
            random_state=config.training.random_seed,
            n_jobs=-1,
        )
        model.fit(x_train, y_train)

    probabilities = model.predict_proba(x_test)
    top1_predictions = probabilities.argmax(axis=1)
    top_k = min(config.training.top_k, len(encoder.classes_))
    top1_accuracy = accuracy_score(y_test, top1_predictions)
    if len(encoder.classes_) <= top_k:
        top3_accuracy = 1.0
    else:
        top3_accuracy = top_k_accuracy_score(
            y_test,
            probabilities,
            k=top_k,
            labels=list(range(len(encoder.classes_))),
        )
    mean_reciprocal_rank = _mean_reciprocal_rank(y_test.tolist(), probabilities.tolist())

    bundle = {
        "model": model,
        "vectorizer": vectorizer,
        "label_encoder": encoder,
        "model_family": model_family,
        "trained_at": datetime.now(UTC).isoformat(),
    }
    save_model(config.paths.baseline_model_path, bundle)

    metadata = {
        "project": config.project.name,
        "version": config.project.version,
        "model_family": model_family,
        "trained_at": bundle["trained_at"],
        "train_rows": len(train_frame),
        "validation_rows": len(validation_frame),
        "test_rows": len(test_frame),
        "unique_labels": int(len(encoder.classes_)),
        "top1_accuracy": float(top1_accuracy),
        "top3_accuracy": float(top3_accuracy),
        "mean_reciprocal_rank": float(mean_reciprocal_rank),
        "labels": encoder.classes_.tolist(),
    }
    save_metadata(config.paths.baseline_metadata_path, metadata)
    save_metadata(config.paths.evaluation_metrics_path, metadata)

    report = "\n".join(
        [
            "# Next Item Baseline Evaluation",
            "",
            f"- model family: `{model_family}`",
            f"- trained at: `{bundle['trained_at']}`",
            f"- train rows: `{len(train_frame)}`",
            f"- validation rows: `{len(validation_frame)}`",
            f"- test rows: `{len(test_frame)}`",
            f"- unique labels: `{len(encoder.classes_)}`",
            f"- top-1 accuracy: `{top1_accuracy:.4f}`",
            f"- top-{top_k} accuracy: `{top3_accuracy:.4f}`",
            f"- mean reciprocal rank: `{mean_reciprocal_rank:.4f}`",
        ]
    )
    config.paths.evaluation_report_path.parent.mkdir(parents=True, exist_ok=True)
    config.paths.evaluation_report_path.write_text(report, encoding="utf-8")

    return TrainingSummary(
        model_family=model_family,
        train_rows=len(train_frame),
        validation_rows=len(validation_frame),
        test_rows=len(test_frame),
        unique_labels=len(encoder.classes_),
        top1_accuracy=float(top1_accuracy),
        top3_accuracy=float(top3_accuracy),
        mean_reciprocal_rank=float(mean_reciprocal_rank),
        model_path=str(config.paths.baseline_model_path),
        metadata_path=str(config.paths.baseline_metadata_path),
        evaluation_report_path=str(config.paths.evaluation_report_path),
    )


def main() -> None:
    summary = train_baseline(load_config())
    print(asdict(summary))


if __name__ == "__main__":
    main()
