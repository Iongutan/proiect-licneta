"""CVRP cu preluare și livrare (Pickup & Delivery) peste capacitatea în paleți.

Noduri: 0 = depozit, 1..n = preluări, n+1..2n = livrări.
Constrângeri: aceeași mașină preia și livrează o cerere, preluarea înaintea
livrării, încărcătura nu depășește niciodată capacitatea în paleți. Cererile
care nu încap nicăieri sunt întoarse ca „neasignate”, nu ignorate în tăcere.
"""
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from .osrm import DistanceMatrix
from .schemas import Point, RoutingRequest, RoutingResponse, Stop, VehicleRoute

SERVICE_MIN_PER_STOP = 15
_DROP_PENALTY = 10_000_000  # metri; mult peste orice rută reală din Moldova


def build_points(req: RoutingRequest) -> list[Point]:
    return [req.depot] + [s.pickup for s in req.shipments] + [s.dropoff for s in req.shipments]


def solve(req: RoutingRequest, matrix: DistanceMatrix) -> RoutingResponse:
    shipments = req.shipments
    n = len(shipments)
    points = build_points(req)
    max_capacity = max(v.pallet_capacity for v in req.vehicles)

    meters = [[int(round(matrix.km[i][j] * 1000)) for j in range(len(points))] for i in range(len(points))]

    manager = pywrapcp.RoutingIndexManager(len(points), len(req.vehicles), 0)
    model = pywrapcp.RoutingModel(manager)

    def distance_cb(from_idx: int, to_idx: int) -> int:
        return meters[manager.IndexToNode(from_idx)][manager.IndexToNode(to_idx)]

    transit = model.RegisterTransitCallback(distance_cb)
    model.SetArcCostEvaluatorOfAllVehicles(transit)
    model.AddDimension(transit, 0, 10_000_000, True, "Distance")
    distance_dim = model.GetDimensionOrDie("Distance")

    def demand_cb(idx: int) -> int:
        node = manager.IndexToNode(idx)
        if 1 <= node <= n:
            return shipments[node - 1].pallets
        if node > n:
            return -shipments[node - 1 - n].pallets
        return 0

    demand = model.RegisterUnaryTransitCallback(demand_cb)
    model.AddDimensionWithVehicleCapacity(
        demand, 0, [v.pallet_capacity for v in req.vehicles], True, "Pallets"
    )

    solver = model.solver()
    for i in range(n):
        pickup = manager.NodeToIndex(i + 1)
        dropoff = manager.NodeToIndex(i + 1 + n)
        model.AddPickupAndDelivery(pickup, dropoff)
        solver.Add(model.VehicleVar(pickup) == model.VehicleVar(dropoff))
        solver.Add(distance_dim.CumulVar(pickup) <= distance_dim.CumulVar(dropoff))
        solver.Add(model.ActiveVar(pickup) == model.ActiveVar(dropoff))
        model.AddDisjunction([pickup], _DROP_PENALTY)
        model.AddDisjunction([dropoff], _DROP_PENALTY)
        if shipments[i].pallets > max_capacity:
            solver.Add(model.ActiveVar(pickup) == 0)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.seconds = req.time_limit_s

    solution = model.SolveWithParameters(params)
    if solution is None:
        return RoutingResponse(
            routes=[], unassigned_ids=[s.id for s in shipments],
            total_distance_km=0.0, matrix_source=matrix.source,
        )

    routes: list[VehicleRoute] = []
    served: set[str] = set()
    for v_idx, vehicle in enumerate(req.vehicles):
        if not model.IsVehicleUsed(solution, v_idx):
            continue
        stops: list[Stop] = []
        load = 0
        distance_km = 0.0
        minutes = 0.0
        index = model.Start(v_idx)
        while True:
            node = manager.IndexToNode(index)
            if node == 0:
                kind, shipment_id = "depot", None
            elif node <= n:
                kind, shipment_id = "pickup", shipments[node - 1].id
                load += shipments[node - 1].pallets
            else:
                kind, shipment_id = "dropoff", shipments[node - 1 - n].id
                load -= shipments[node - 1 - n].pallets
            if shipment_id:
                served.add(shipment_id)
                minutes += SERVICE_MIN_PER_STOP
            stops.append(Stop(shipment_id=shipment_id, kind=kind, point=points[node], load_after=load))
            if model.IsEnd(index):
                break
            nxt = solution.Value(model.NextVar(index))
            nxt_node = manager.IndexToNode(nxt)
            distance_km += float(matrix.km[node][nxt_node])
            minutes += float(matrix.minutes[node][nxt_node])
            index = nxt
        routes.append(VehicleRoute(
            vehicle_id=vehicle.id, stops=stops,
            distance_km=round(distance_km, 1), duration_min=round(minutes, 0),
        ))

    return RoutingResponse(
        routes=routes,
        unassigned_ids=[s.id for s in shipments if s.id not in served],
        total_distance_km=round(sum(r.distance_km for r in routes), 1),
        matrix_source=matrix.source,
    )
