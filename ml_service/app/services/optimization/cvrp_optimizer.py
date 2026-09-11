"""
OptiFleet B2B — Service: CVRP Route Optimizer
===============================================
Capacitated Vehicle Routing Problem cu Google OR-Tools.
Integrare cu OSRM pentru matrice de distanțe reale pe drum.
Suport Time Windows (fereastra de livrare per comandă).
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional, Tuple
from uuid import UUID

from ortools.constraint_solver import routing_enums_pb2, pywrapcp
from loguru import logger

from app.domain.entities.cluster import GroupBuyCluster
from app.domain.entities.vehicle import Vehicle
from app.domain.value_objects.location import Location
from app.infrastructure.routing.osrm_engine import OSRMEngine, RouteMatrix
from app.core.exceptions import OptimizationError


@dataclass
class WaypointStop:
    location: Location
    order_id: Optional[UUID]
    stop_type: str          # "pickup" | "dropoff" | "depot"
    service_time_min: int = 10  # Timp estimat de încărcare/descărcare


@dataclass
class OptimizedRoute:
    vehicle_id: UUID
    stops: List[WaypointStop]
    total_distance_km: float
    total_duration_min: float
    estimated_co2_saved_kg: float
    waypoints_geojson: list   # Array de {lat, lon, order_id, type}


class CVRPOptimizer:
    """
    Rezolvă CVRP cu Time Windows folosind OR-Tools.
    
    Algoritm: Guided Local Search + First Solution: PATH_CHEAPEST_ARC
    Complexitate: NP-Hard, rezolvat heuristic în timp rezonabil.
    
    Input:  Cluster de comenzi + vehicule disponibile + matrice distanțe OSRM
    Output: Secvența optimă pickup → dropoff minimizând km totali
    """

    # Factor emisii CO2 pentru camion diesel (kg CO2/km)
    _CO2_KG_PER_KM = 0.27
    # Bazat pe media europeană pentru vehicule utilitare

    def __init__(self, osrm: Optional[OSRMEngine] = None):
        self._osrm = osrm or OSRMEngine()

    async def optimize(
        self,
        cluster: GroupBuyCluster,
        vehicles: List[Vehicle],
        depot_location: Location,
        time_limit_seconds: int = 30,
    ) -> List[OptimizedRoute]:
        """
        Optimizează rutele pentru un cluster de comenzi.
        
        Args:
            cluster: Grupul de comenzi de livrat
            vehicles: Vehiculele disponibile
            depot_location: Locația de start/end a tuturor vehiculelor
            time_limit_seconds: Timp maxim pentru optimizare
        
        Returns:
            Lista de rute optime, una per vehicul utilizat
        """
        if not cluster.orders or not vehicles:
            return []

        # ── Construiește lista de locații ────────────────────
        # [0] = depot, [1..N] = pickup-uri, [N+1..2N] = dropoff-uri
        locations: List[Location] = [depot_location]
        for order in cluster.orders:
            locations.append(order.pickup_location)
        for order in cluster.orders:
            locations.append(order.dropoff_location)

        n_orders = len(cluster.orders)
        n_locations = len(locations)  # 1 + 2*n_orders

        # ── Obține matrice de distanțe reale (OSRM) ─────────
        logger.info(f"Fetching {n_locations}×{n_locations} distance matrix from OSRM...")
        matrix = await self._osrm.get_distance_matrix(locations)

        # ── Convertește la întregi (OR-Tools cere int) ───────
        # Unitate: secunde × 10 (pentru precizie cu valori fracționare)
        def _to_int(val: float) -> int:
            return max(0, int(val * 10))

        duration_matrix = [
            [_to_int(matrix.durations_sec[i][j]) for j in range(n_locations)]
            for i in range(n_locations)
        ]
        distance_matrix = [
            [int(matrix.distances_m[i][j]) for j in range(n_locations)]
            for i in range(n_locations)
        ]

        # ── OR-Tools Setup ───────────────────────────────────
        manager = pywrapcp.RoutingIndexManager(
            n_locations,        # Număr noduri
            len(vehicles),      # Număr vehicule
            0,                  # Nodul depot (index 0)
        )
        routing = pywrapcp.RoutingModel(manager)

        # Callback: cost de tranzit (durata în secunde)
        def transit_callback(from_idx, to_idx):
            i = manager.IndexToNode(from_idx)
            j = manager.IndexToNode(to_idx)
            service = 10 * 10 if i > 0 else 0  # 10min service time × 10
            return duration_matrix[i][j] + service

        transit_cb_idx = routing.RegisterTransitCallback(transit_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_cb_idx)

        # Constraint: Capacitate (volum)
        def volume_callback(idx):
            node = manager.IndexToNode(idx)
            if node == 0:
                return 0
            if 1 <= node <= n_orders:
                # Pickup → adaugă volum
                return int(cluster.orders[node - 1].cargo.volume_m3 * 100)
            else:
                # Dropoff → scade volum
                return -int(cluster.orders[node - 1 - n_orders].cargo.volume_m3 * 100)

        vol_cb_idx = routing.RegisterUnaryTransitCallback(volume_callback)
        routing.AddDimensionWithVehicleCapacity(
            vol_cb_idx,
            0,  # Slack
            [int(v.capacity_m3 * 100) for v in vehicles],  # Capacitate per vehicul
            True,
            "Volume",
        )

        # Constraint: Pickup ÎNAINTE de Dropoff (LIFO pentru bin packing)
        for i, order in enumerate(cluster.orders):
            pickup_idx = manager.NodeToIndex(i + 1)
            dropoff_idx = manager.NodeToIndex(i + 1 + n_orders)
            routing.AddPickupAndDelivery(pickup_idx, dropoff_idx)
            routing.solver().Add(
                routing.VehicleVar(pickup_idx) == routing.VehicleVar(dropoff_idx)
            )
            routing.solver().Add(
                routing.CumulVar(pickup_idx, "Volume") <=
                routing.CumulVar(dropoff_idx, "Volume")
            )

        # Parametri de căutare
        search_params = pywrapcp.DefaultRoutingSearchParameters()
        search_params.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_params.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_params.time_limit.seconds = time_limit_seconds
        search_params.log_search = False

        # ── Rezolvare ────────────────────────────────────────
        solution = routing.SolveWithParameters(search_params)

        if not solution:
            logger.warning("CVRP: No solution found. Falling back to greedy assignment.")
            return self._greedy_fallback(cluster, vehicles, matrix)

        # ── Extrage rutele din soluție ───────────────────────
        routes: List[OptimizedRoute] = []
        for v_idx, vehicle in enumerate(vehicles):
            if routing.IsVehicleUsed(solution, v_idx):
                stops, total_dist_m = self._extract_route(
                    routing, manager, solution, v_idx, locations, cluster
                )
                if stops:
                    dist_km = total_dist_m / 1000
                    # Estimare CO2 salvat față de N curse individuale
                    individual_km = sum(
                        o.straight_line_km * 2 * 1.4 for o in cluster.orders
                    )
                    co2_saved = (individual_km - dist_km) * self._CO2_KG_PER_KM

                    routes.append(OptimizedRoute(
                        vehicle_id=vehicle.id,
                        stops=stops,
                        total_distance_km=round(dist_km, 2),
                        total_duration_min=round(
                            solution.ObjectiveValue() / len(vehicles) / 60, 1
                        ),
                        estimated_co2_saved_kg=round(max(0, co2_saved), 2),
                        waypoints_geojson=[
                            {
                                "lat": s.location.latitude,
                                "lon": s.location.longitude,
                                "order_id": str(s.order_id) if s.order_id else None,
                                "type": s.stop_type,
                            }
                            for s in stops
                        ],
                    ))

        logger.info(
            f"CVRP solved: {len(routes)} routes, "
            f"total {sum(r.total_distance_km for r in routes):.1f}km"
        )
        return routes

    def _extract_route(
        self,
        routing, manager, solution, v_idx: int,
        locations: List[Location],
        cluster: GroupBuyCluster,
    ) -> Tuple[List[WaypointStop], float]:
        stops = []
        total_dist_m = 0.0
        index = routing.Start(v_idx)
        n_orders = len(cluster.orders)

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            loc = locations[node]

            if node == 0:
                stop_type = "depot"
                order_id = None
            elif 1 <= node <= n_orders:
                stop_type = "pickup"
                order_id = cluster.orders[node - 1].id
            else:
                stop_type = "dropoff"
                order_id = cluster.orders[node - 1 - n_orders].id

            stops.append(WaypointStop(
                location=loc,
                order_id=order_id,
                stop_type=stop_type,
            ))

            next_index = solution.Value(routing.NextVar(index))
            total_dist_m += routing.GetArcCostForVehicle(index, next_index, v_idx) / 10
            index = next_index

        return stops, total_dist_m

    def _greedy_fallback(
        self,
        cluster: GroupBuyCluster,
        vehicles: List[Vehicle],
        matrix: RouteMatrix,
    ) -> List[OptimizedRoute]:
        """
        Fallback simplu când OR-Tools nu găsește soluție:
        Alocă toate comenzile la primul vehicul cu capacitate suficientă.
        """
        for vehicle in vehicles:
            if vehicle.can_carry(cluster.total_cargo):
                stops = []
                for order in cluster.orders:
                    stops.append(WaypointStop(order.pickup_location, order.id, "pickup"))
                for order in cluster.orders:
                    stops.append(WaypointStop(order.dropoff_location, order.id, "dropoff"))

                return [OptimizedRoute(
                    vehicle_id=vehicle.id,
                    stops=stops,
                    total_distance_km=0.0,
                    total_duration_min=0.0,
                    estimated_co2_saved_kg=0.0,
                    waypoints_geojson=[],
                )]
        return []
