from __future__ import annotations

from collections.abc import Sequence

import pandas as pd
from sklearn.datasets import make_classification


def build_baseline_dataset(
    *,
    random_seed: int,
    n_samples: int,
    n_features: int,
    n_informative: int,
) -> tuple[pd.DataFrame, pd.Series]:
    """Build a deterministic tabular dataset for local baseline training."""
    feature_names: Sequence[str] = [f"feature_{index}" for index in range(n_features)]
    features, target = make_classification(
        n_samples=n_samples,
        n_features=n_features,
        n_informative=n_informative,
        n_redundant=0,
        n_repeated=0,
        n_classes=2,
        random_state=random_seed,
    )
    frame = pd.DataFrame(features, columns=feature_names)
    labels = pd.Series(target, name="label")
    return frame, labels

