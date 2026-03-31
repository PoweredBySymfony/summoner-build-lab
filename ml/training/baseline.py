from __future__ import annotations

from dataclasses import asdict, dataclass

import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

from features.baseline_dataset import build_baseline_dataset
from inference.config import AppConfig, load_config
from models.artifacts import save_metadata, save_model


@dataclass(slots=True)
class TrainingSummary:
    accuracy: float
    rows: int
    model_path: str
    metadata_path: str


def train_baseline(config: AppConfig) -> TrainingSummary:
    dataset, labels = build_baseline_dataset(
        random_seed=config.training.random_seed,
        n_samples=config.training.n_samples,
        n_features=config.training.n_features,
        n_informative=config.training.n_informative,
    )
    train_frame, test_frame, train_labels, test_labels = train_test_split(
        dataset,
        labels,
        test_size=config.training.test_size,
        random_state=config.training.random_seed,
        stratify=labels,
    )
    model = HistGradientBoostingClassifier(random_state=config.training.random_seed)
    model.fit(train_frame, train_labels)
    predictions = model.predict(test_frame)
    accuracy = accuracy_score(test_labels, predictions)

    processed_dataset_path = config.paths.processed_data_dir / "baseline_training_data.parquet"
    processed_dataset_path.parent.mkdir(parents=True, exist_ok=True)
    pd.concat([dataset, labels], axis=1).to_parquet(processed_dataset_path, index=False)

    save_model(config.paths.baseline_model_path, model)
    metadata = {
        "project": config.project.name,
        "version": config.project.version,
        "accuracy": accuracy,
        "rows": len(dataset),
        "features": list(dataset.columns),
    }
    save_metadata(config.paths.baseline_metadata_path, metadata)

    return TrainingSummary(
        accuracy=accuracy,
        rows=len(dataset),
        model_path=str(config.paths.baseline_model_path),
        metadata_path=str(config.paths.baseline_metadata_path),
    )


def main() -> None:
    config = load_config()
    summary = train_baseline(config)
    print(asdict(summary))


if __name__ == "__main__":
    main()
