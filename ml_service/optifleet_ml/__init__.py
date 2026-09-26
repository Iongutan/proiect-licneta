"""OptiFleet ML — serviciu de calcul intern, fără stare și fără acces la baza de date.

Primește datele deja filtrate de serverul Next.js (care le citește cu sesiunea
utilizatorului, deci prin RLS) și întoarce doar rezultate de calcul:
grupare DBSCAN, optimizare CVRP și interpretare de intenție cu Qwen3.
"""
