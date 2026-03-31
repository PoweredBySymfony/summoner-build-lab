from fastapi.testclient import TestClient

from inference.api import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "summoner-build-lab-ml"


def test_version_endpoint() -> None:
    response = client.get("/version")
    assert response.status_code == 200
    assert response.json()["version"] == "0.1.0"


def test_predict_next_item_stub() -> None:
    response = client.post(
        "/predict-next-item",
        json={"candidate_item_ids": ["1001", "2003"], "context": {"phase": "lane"}},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["predicted_item_id"] is None
    assert payload["ranked_candidates"] == ["1001", "2003"]
    assert payload["model_ready"] is False

