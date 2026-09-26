"""Grupare (group-buying) a cererilor de transport cu DBSCAN.

Două cereri sunt „vecine” dacă AMBELE capete sunt apropiate (preluare lângă
preluare și livrare lângă livrare) și ferestrele de timp se suprapun. Distanța
folosită e deci max(d_preluare, d_livrare), iar perechile incompatibile în timp
primesc o distanță infinită. DBSCAN nu cere un număr fix de grupuri și lasă
cererile izolate negrupate (outlieri).

Un grup DBSCAN poate depăși capacitatea unui camion, așa că fiecare grup e
împărțit apoi în „încărcături” care încap (first-fit descrescător).
"""
import numpy as np
from sklearn.cluster import DBSCAN

from .geo import ROAD_FACTOR, haversine_km, haversine_matrix_km
from .schemas import GroupingRequest, GroupingResponse, Point, Shipment, ShipmentGroup

_INCOMPATIBLE_KM = 1e6


def _pair_distance_km(shipments: list[Shipment]) -> np.ndarray:
    pick = haversine_matrix_km(
        np.array([s.pickup.lat for s in shipments]), np.array([s.pickup.lon for s in shipments])
    )
    drop = haversine_matrix_km(
        np.array([s.dropoff.lat for s in shipments]), np.array([s.dropoff.lon for s in shipments])
    )
    dist = np.maximum(pick, drop)

    for i, a in enumerate(shipments):
        for j in range(i + 1, len(shipments)):
            b = shipments[j]
            if a.ready_from and a.deliver_by and b.ready_from and b.deliver_by:
                if a.deliver_by <= b.ready_from or b.deliver_by <= a.ready_from:
                    dist[i, j] = dist[j, i] = _INCOMPATIBLE_KM
    return dist


def _split_by_capacity(members: list[Shipment], capacity: int) -> list[list[Shipment]]:
    bins: list[list[Shipment]] = []
    loads: list[int] = []
    for s in sorted(members, key=lambda m: m.pallets, reverse=True):
        for idx, load in enumerate(loads):
            if load + s.pallets <= capacity:
                bins[idx].append(s)
                loads[idx] += s.pallets
                break
        else:
            bins.append([s])
            loads.append(s.pallets)
    return bins


def _nearest_neighbour_km(points: list[Point], start: Point) -> tuple[float, Point]:
    remaining = list(points)
    current = start
    total = 0.0
    while remaining:
        nxt = min(remaining, key=lambda p: haversine_km(current.lat, current.lon, p.lat, p.lon))
        total += haversine_km(current.lat, current.lon, nxt.lat, nxt.lon)
        remaining.remove(nxt)
        current = nxt
    return total, current


def _centroid(points: list[Point]) -> Point:
    return Point(lat=float(np.mean([p.lat for p in points])), lon=float(np.mean([p.lon for p in points])))


def _describe(members: list[Shipment]) -> ShipmentGroup:
    pickups = [s.pickup for s in members]
    dropoffs = [s.dropoff for s in members]
    individual = sum(
        haversine_km(s.pickup.lat, s.pickup.lon, s.dropoff.lat, s.dropoff.lon) for s in members
    ) * ROAD_FACTOR

    # Cursa comună: toate preluările, apoi toate livrările (euristica vecinului cel mai apropiat).
    pick_centroid = _centroid(pickups)
    first = min(pickups, key=lambda p: haversine_km(p.lat, p.lon, pick_centroid.lat, pick_centroid.lon))
    pick_km, last_pickup = _nearest_neighbour_km([p for p in pickups if p is not first], first)
    drop_km, _ = _nearest_neighbour_km(dropoffs, last_pickup)
    consolidated = (pick_km + drop_km) * ROAD_FACTOR

    savings = 0.0 if individual <= 0 else max(0.0, 1.0 - consolidated / individual) * 100
    return ShipmentGroup(
        shipment_ids=[s.id for s in members],
        pallets_total=sum(s.pallets for s in members),
        pickup_centroid=pick_centroid,
        dropoff_centroid=_centroid(dropoffs),
        individual_km=round(individual, 1),
        consolidated_km=round(consolidated, 1),
        savings_pct=round(savings, 1),
    )


def group_shipments(req: GroupingRequest) -> GroupingResponse:
    shipments = req.shipments
    algorithm = f"DBSCAN(precomputed max-endpoint haversine, eps={req.eps_km}km, min={req.min_group_size})"
    if len(shipments) < req.min_group_size:
        return GroupingResponse(groups=[], ungrouped_ids=[s.id for s in shipments], algorithm=algorithm)

    labels = DBSCAN(eps=req.eps_km, min_samples=req.min_group_size, metric="precomputed").fit_predict(
        _pair_distance_km(shipments)
    )

    groups: list[ShipmentGroup] = []
    ungrouped: list[str] = [s.id for s, lbl in zip(shipments, labels) if lbl == -1]
    for label in sorted(set(labels) - {-1}):
        members = [s for s, lbl in zip(shipments, labels) if lbl == label]
        for load in _split_by_capacity(members, req.max_group_pallets):
            if len(load) >= req.min_group_size:
                groups.append(_describe(load))
            else:
                ungrouped.extend(s.id for s in load)

    groups.sort(key=lambda g: g.savings_pct, reverse=True)
    return GroupingResponse(groups=groups, ungrouped_ids=ungrouped, algorithm=algorithm)
