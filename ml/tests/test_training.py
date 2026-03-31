from pathlib import Path

from inference.config import (
    ApiConfig,
    AppConfig,
    PathsConfig,
    ProjectConfig,
    TrainingConfig,
)
from training.baseline import train_baseline


def test_train_baseline_creates_local_artifacts(tmp_path: Path) -> None:
    config = AppConfig(
        project=ProjectConfig(name="summoner-build-lab-ml", version="0.1.0", environment="test"),
        paths=PathsConfig(
            artifacts_dir=tmp_path / "artifacts",
            raw_data_dir=tmp_path / "raw",
            interim_data_dir=tmp_path / "interim",
            processed_data_dir=tmp_path / "processed",
            baseline_model_path=tmp_path / "artifacts" / "models" / "baseline.joblib",
            baseline_metadata_path=tmp_path / "artifacts" / "models" / "baseline-metadata.json",
        ),
        training=TrainingConfig(
            random_seed=7,
            test_size=0.25,
            n_samples=64,
            n_features=6,
            n_informative=4,
        ),
        api=ApiConfig(host="127.0.0.1", port=8001, log_level="info"),
    )

    summary = train_baseline(config)

    assert summary.rows == 64
    assert Path(summary.model_path).exists()
    assert Path(summary.metadata_path).exists()
    assert 0.0 <= summary.accuracy <= 1.0
