"""API: autentificare internă și limite de intrare."""
import os

import pytest
from fastapi.testclient import TestClient

TOKEN = "t" * 40
os.environ["INTERNAL_API_TOKEN"] = TOKEN
os.environ["OSRM_BASE_URL"] = "http://127.0.0.1:9"  # inaccesibil → rezerva Haversine

from optifleet_ml.api import create_app  # noqa: E402
from optifleet_ml.config import get_settings  # noqa: E402

BODY = {
    "shipments": [
        {"id": "a", "pickup": {"lat": 47.01, "lon": 28.86}, "dropoff": {"lat": 47.76, "lon": 27.93}, "pallets": 2},
        {"id": "b", "pickup": {"lat": 46.99, "lon": 28.86}, "dropoff": {"lat": 47.78, "lon": 27.92}, "pallets": 3},
    ]
}


@pytest.fixture()
def client():
    get_settings.cache_clear()
    return TestClient(create_app())


def test_health_is_public(client):
    assert client.get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize("header", [None, "Bearer wrong", f"Bearer {TOKEN}x", "Basic abc"])
def test_rejects_missing_or_wrong_token(client, header):
    headers = {"Authorization": header} if header else {}
    assert client.post("/v1/grouping", json=BODY, headers=headers).status_code == 401


def test_grouping_with_token(client):
    res = client.post("/v1/grouping", json=BODY, headers={"Authorization": f"Bearer {TOKEN}"})
    assert res.status_code == 200
    assert res.json()["groups"][0]["pallets_total"] == 5


def test_routing_falls_back_to_haversine(client):
    body = {**BODY, "depot": {"lat": 47.01, "lon": 28.86}, "vehicles": [{"id": "v", "pallet_capacity": 33}], "time_limit_s": 1}
    res = client.post("/v1/routing/optimize", json=body, headers={"Authorization": f"Bearer {TOKEN}"})
    assert res.status_code == 200
    assert res.json()["matrix_source"] == "haversine"


def test_rejects_out_of_range_input(client):
    bad = {"shipments": [{**BODY["shipments"][0], "pallets": 500}]}
    res = client.post("/v1/grouping", json=bad, headers={"Authorization": f"Bearer {TOKEN}"})
    assert res.status_code == 422


def test_short_token_refuses_to_start():
    os.environ["INTERNAL_API_TOKEN"] = "short"
    get_settings.cache_clear()
    try:
        with pytest.raises(Exception):
            create_app()
    finally:
        os.environ["INTERNAL_API_TOKEN"] = TOKEN
        get_settings.cache_clear()
