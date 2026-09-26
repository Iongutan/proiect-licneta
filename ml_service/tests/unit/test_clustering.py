"""Grupare DBSCAN + CVRP — teste pe coordonate reale din Moldova."""
from datetime import datetime, timedelta, timezone

from optifleet_ml.grouping import group_shipments
from optifleet_ml.osrm import haversine_fallback
from optifleet_ml.routing import build_points, solve
from optifleet_ml.schemas import GroupingRequest, Point, RoutingRequest, Shipment, VehicleIn

CHISINAU = Point(lat=47.0105, lon=28.8638)
CHISINAU_BOTANICA = Point(lat=46.9850, lon=28.8570)
BALTI = Point(lat=47.7617, lon=27.9290)
BALTI_NORD = Point(lat=47.7800, lon=27.9200)
CAHUL = Point(lat=45.9075, lon=28.1944)

NOW = datetime(2026, 9, 26, 8, tzinfo=timezone.utc)


def ship(sid: str, pickup: Point, dropoff: Point, pallets: int = 2, start_h: int = 0, end_h: int = 24) -> Shipment:
    return Shipment(
        id=sid, pickup=pickup, dropoff=dropoff, pallets=pallets,
        ready_from=NOW + timedelta(hours=start_h), deliver_by=NOW + timedelta(hours=end_h),
    )


class TestGrouping:
    def test_same_corridor_is_grouped_and_outlier_is_left_alone(self):
        res = group_shipments(GroupingRequest(shipments=[
            ship("a", CHISINAU, BALTI),
            ship("b", CHISINAU_BOTANICA, BALTI_NORD),
            ship("c", CHISINAU, CAHUL),
        ]))
        assert [sorted(g.shipment_ids) for g in res.groups] == [["a", "b"]]
        assert res.ungrouped_ids == ["c"]

    def test_group_saves_distance(self):
        res = group_shipments(GroupingRequest(shipments=[
            ship("a", CHISINAU, BALTI), ship("b", CHISINAU_BOTANICA, BALTI_NORD),
        ]))
        group = res.groups[0]
        assert group.consolidated_km < group.individual_km
        assert 30 < group.savings_pct < 60

    def test_non_overlapping_time_windows_are_not_grouped(self):
        res = group_shipments(GroupingRequest(shipments=[
            ship("a", CHISINAU, BALTI, start_h=0, end_h=4),
            ship("b", CHISINAU_BOTANICA, BALTI_NORD, start_h=10, end_h=20),
        ]))
        assert res.groups == []
        assert sorted(res.ungrouped_ids) == ["a", "b"]

    def test_group_is_split_when_it_exceeds_truck_capacity(self):
        res = group_shipments(GroupingRequest(
            shipments=[ship(f"s{i}", CHISINAU, BALTI, pallets=12) for i in range(4)],
            max_group_pallets=33,
        ))
        assert all(g.pallets_total <= 33 for g in res.groups)
        grouped = sorted(sid for g in res.groups for sid in g.shipment_ids)
        assert sorted(grouped + res.ungrouped_ids) == ["s0", "s1", "s2", "s3"]


class TestRouting:
    def test_pickup_precedes_dropoff_and_capacity_is_respected(self):
        req = RoutingRequest(
            depot=CHISINAU,
            vehicles=[VehicleIn(id="truck", pallet_capacity=10)],
            shipments=[ship("a", CHISINAU, BALTI, pallets=4), ship("b", CHISINAU_BOTANICA, BALTI_NORD, pallets=5)],
            time_limit_s=2,
        )
        res = solve(req, haversine_fallback(build_points(req)))
        assert res.unassigned_ids == []
        route = res.routes[0]
        order = [(s.kind, s.shipment_id) for s in route.stops]
        for sid in ("a", "b"):
            assert order.index(("pickup", sid)) < order.index(("dropoff", sid))
        assert max(s.load_after for s in route.stops) <= 10
        assert route.distance_km > 200  # dus-întors Chișinău–Bălți

    def test_oversized_shipment_is_reported_unassigned(self):
        req = RoutingRequest(
            depot=CHISINAU,
            vehicles=[VehicleIn(id="van", pallet_capacity=4)],
            shipments=[ship("big", CHISINAU, BALTI, pallets=10), ship("ok", CHISINAU, BALTI, pallets=2)],
            time_limit_s=2,
        )
        res = solve(req, haversine_fallback(build_points(req)))
        assert res.unassigned_ids == ["big"]
