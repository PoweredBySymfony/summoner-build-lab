from __future__ import annotations

from typing import Any

from training.ranking import RankingTrainingSummary, train_ranking_model


def train_baseline(config: Any) -> RankingTrainingSummary:
    return train_ranking_model(config)


def main() -> None:
    from dataclasses import asdict

    from inference.config import load_config

    summary: RankingTrainingSummary = train_ranking_model(load_config())
    print(asdict(summary))


if __name__ == "__main__":
    main()
