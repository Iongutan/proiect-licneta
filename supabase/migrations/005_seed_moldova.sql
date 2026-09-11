-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet B2B — Migration 005: Seed Data Moldova (Demo / Teză Licență)
-- FIX: UUID-uri corectate (doar caractere hex valide: 0-9, a-f)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── COMPANIES ──────────────────────────────────────────────────────────────
-- UUID prefix-uri folosite:
--   ca1xxxxx = Carrier
--   5e1xxxxx = SME (5e = hex valid, ușor de reținut ca "SE")
--   fa1xxxxx = furnizor (supplier)

-- Transportatori (CARRIER)
INSERT INTO companies (id, name, type, email, phone, city, location, is_active) VALUES
(
    'ca100000-0000-0000-0000-000000000001',
    'TransMold Express SRL',
    'CARRIER', 'contact@transmold.md', '+373 22 123 456', 'Chișinău',
    ST_SetSRID(ST_MakePoint(28.8638, 47.0105), 4326), true
),
(
    'ca100000-0000-0000-0000-000000000002',
    'LogiSpeed Moldova SA',
    'CARRIER', 'office@logispeed.md', '+373 22 789 012', 'Bălți',
    ST_SetSRID(ST_MakePoint(27.9290, 47.7630), 4326), true
),
(
    'ca100000-0000-0000-0000-000000000003',
    'CargoPro Chișinău SRL',
    'CARRIER', 'dispatch@cargopro.md', '+373 22 345 678', 'Chișinău',
    ST_SetSRID(ST_MakePoint(28.9135, 47.0283), 4326), true
);

-- IMM-uri (SME)
INSERT INTO companies (id, name, type, email, phone, city, location, is_active) VALUES
('5e100000-0000-0000-0000-000000000001', 'TechMold Electronics SRL',   'SME', 'orders@techmold.md',    '+373 60 100 001', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8750, 47.0200), 4326), true),
('5e100000-0000-0000-0000-000000000002', 'AgroSupply Moldova SA',       'SME', 'purchase@agrosupply.md','+373 60 100 002', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8510, 47.0080), 4326), true),
('5e100000-0000-0000-0000-000000000003', 'MoldTech Innovations SRL',   'SME', 'logistics@moldtech.md', '+373 60 100 003', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8900, 47.0150), 4326), true),
('5e100000-0000-0000-0000-000000000004', 'ProFood Distribution SRL',   'SME', 'orders@profood.md',     '+373 60 100 004', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8680, 47.0310), 4326), true),
('5e100000-0000-0000-0000-000000000005', 'UrbanMart Retail SRL',       'SME', 'supply@urbanmart.md',   '+373 60 100 005', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8820, 47.0420), 4326), true),
('5e100000-0000-0000-0000-000000000006', 'GreenFarm Organic SRL',      'SME', 'import@greenfarm.md',   '+373 60 100 006', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8460, 47.0560), 4326), true),
('5e100000-0000-0000-0000-000000000007', 'MedEquip Moldova SRL',       'SME', 'orders@medequip.md',    '+373 60 100 007', 'Chișinău', ST_SetSRID(ST_MakePoint(28.9010, 47.0490), 4326), true),
('5e100000-0000-0000-0000-000000000008', 'BuildPro Materials SRL',     'SME', 'delivery@buildpro.md',  '+373 60 100 008', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8310, 47.0180), 4326), true),
('5e100000-0000-0000-0000-000000000009', 'FashionImport Moldova SRL',  'SME', 'stock@fashion.md',      '+373 60 100 009', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8720, 47.0070), 4326), true),
('5e100000-0000-0000-0000-00000000000a', 'DigitalHub SRL',             'SME', 'ops@digitalhub.md',     '+373 60 100 010', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8950, 47.0340), 4326), true),
('5e100000-0000-0000-0000-00000000000b', 'AutoParts Moldova SRL',      'SME', 'orders@autoparts.md',   '+373 60 100 011', 'Bălți',    ST_SetSRID(ST_MakePoint(27.9380, 47.7540), 4326), true),
('5e100000-0000-0000-0000-00000000000c', 'Flori de Câmp SRL',          'SME', 'flori@floriccamp.md',   '+373 60 100 012', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8580, 47.0620), 4326), true),
('5e100000-0000-0000-0000-00000000000d', 'CleanTech Moldova SRL',      'SME', 'supply@cleantech.md',   '+373 60 100 013', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8840, 47.0220), 4326), true),
('5e100000-0000-0000-0000-00000000000e', 'ColdChain Solutions SRL',    'SME', 'orders@coldchain.md',   '+373 60 100 014', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8670, 47.0380), 4326), true),
('5e100000-0000-0000-0000-00000000000f', 'PrintShop Central SRL',      'SME', 'paper@printshop.md',    '+373 60 100 015', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8780, 47.0130), 4326), true);

-- Furnizori (SUPPLIER)
INSERT INTO companies (id, name, type, email, phone, city, location, is_active) VALUES
('fa100000-0000-0000-0000-000000000001', 'EuroSupply Group SA',     'SUPPLIER', 'md@eurosupply.eu',     '+373 22 900 001', 'Chișinău', ST_SetSRID(ST_MakePoint(28.9200, 47.0650), 4326), true),
('fa100000-0000-0000-0000-000000000002', 'UkrImport Moldova SRL',   'SUPPLIER', 'moldova@ukrimport.ua', '+373 22 900 002', 'Chișinău', ST_SetSRID(ST_MakePoint(28.8100, 47.0720), 4326), true);


-- ─── VEHICLES (UUID prefix: de1xxxxx = vehicul) ─────────────────────────────

INSERT INTO vehicles (id, carrier_id, license_plate, capacity_m3, max_weight_kg, status, current_location, current_city, driver_name, driver_phone, last_location_update) VALUES
-- TransMold Express (carrier 001)
('de100000-0001-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000001', 'CAN 001', 18.0, 3500, 'AVAILABLE',    ST_SetSRID(ST_MakePoint(28.8450, 47.0050), 4326), 'Chișinău', 'Ion Popescu',    '+373 69 001 001', NOW() - INTERVAL '5 minutes'),
('de100000-0001-0000-0000-000000000002', 'ca100000-0000-0000-0000-000000000001', 'CAN 002', 12.0, 2000, 'AVAILABLE',    ST_SetSRID(ST_MakePoint(28.9000, 47.0300), 4326), 'Chișinău', 'Vasile Marin',   '+373 69 001 002', NOW() - INTERVAL '3 minutes'),
('de100000-0001-0000-0000-000000000003', 'ca100000-0000-0000-0000-000000000001', 'CAN 003', 25.0, 5000, 'ON_ROUTE',     ST_SetSRID(ST_MakePoint(28.8700, 47.0200), 4326), 'Chișinău', 'Andrei Lupu',    '+373 69 001 003', NOW() - INTERVAL '1 minute'),
('de100000-0001-0000-0000-000000000004', 'ca100000-0000-0000-0000-000000000001', 'CAN 004',  8.0, 1200, 'AVAILABLE',    ST_SetSRID(ST_MakePoint(28.8550, 47.0400), 4326), 'Chișinău', 'Mihai Cojocaru', '+373 69 001 004', NOW() - INTERVAL '10 minutes'),
-- LogiSpeed Moldova (carrier 002)
('de100000-0002-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000002', 'BST 101', 20.0, 4000, 'AVAILABLE',    ST_SetSRID(ST_MakePoint(27.9200, 47.7600), 4326), 'Bălți',    'Gheorghe Rusu',  '+373 69 002 001', NOW() - INTERVAL '8 minutes'),
('de100000-0002-0000-0000-000000000002', 'ca100000-0000-0000-0000-000000000002', 'BST 102', 15.0, 3000, 'AVAILABLE',    ST_SetSRID(ST_MakePoint(28.8600, 47.0100), 4326), 'Chișinău', 'Petru Grosu',    '+373 69 002 002', NOW() - INTERVAL '2 minutes'),
('de100000-0002-0000-0000-000000000003', 'ca100000-0000-0000-0000-000000000002', 'BST 103', 30.0, 6000, 'MAINTENANCE',  NULL,                                              NULL,       'Dumitru Botnaru','+373 69 002 003', NOW() - INTERVAL '2 hours'),
('de100000-0002-0000-0000-000000000004', 'ca100000-0000-0000-0000-000000000002', 'BST 104', 10.0, 1800, 'AVAILABLE',    ST_SetSRID(ST_MakePoint(28.8750, 47.0350), 4326), 'Chișinău', 'Victor Palade',  '+373 69 002 004', NOW() - INTERVAL '15 minutes'),
-- CargoPro (carrier 003)
('de100000-0003-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000003', 'CPR 201', 22.0, 4500, 'AVAILABLE',    ST_SetSRID(ST_MakePoint(28.9100, 47.0250), 4326), 'Chișinău', 'Alexei Vrabie',  '+373 69 003 001', NOW() - INTERVAL '7 minutes'),
('de100000-0003-0000-0000-000000000002', 'ca100000-0000-0000-0000-000000000003', 'CPR 202', 16.0, 3200, 'AVAILABLE',    ST_SetSRID(ST_MakePoint(28.8400, 47.0450), 4326), 'Chișinău', 'Sergiu Moraru',  '+373 69 003 002', NOW() - INTERVAL '4 minutes'),
('de100000-0003-0000-0000-000000000003', 'ca100000-0000-0000-0000-000000000003', 'CPR 203', 28.0, 5500, 'ON_ROUTE',     ST_SetSRID(ST_MakePoint(28.8800, 47.0500), 4326), 'Chișinău', 'Nicolae Balan',  '+373 69 003 003', NOW() - INTERVAL '30 seconds'),
('de100000-0003-0000-0000-000000000004', 'ca100000-0000-0000-0000-000000000003', 'CPR 204',  6.0,  800, 'OFFLINE',      NULL,                                              NULL,       'Radu Ciobanu',   '+373 69 003 004', NOW() - INTERVAL '3 hours');


-- ─── ORDERS ─────────────────────────────────────────────────────────────────

INSERT INTO orders (company_id, volume_m3, weight_kg, status, pickup_location, dropoff_location, pickup_address, dropoff_address, delivery_window_start, delivery_window_end) VALUES
-- ZONA 1: Centru Chișinău — PENDING (candidați ideali pentru DBSCAN cluster)
('5e100000-0000-0000-0000-000000000001', 2.4,  380, 'PENDING', ST_SetSRID(ST_MakePoint(28.8750, 47.0200), 4326), ST_SetSRID(ST_MakePoint(28.8300, 47.0550), 4326), 'str. Armenească 22, Chișinău',         'bd. Moscova 14, Chișinău',    NOW() + INTERVAL '2 hours',  NOW() + INTERVAL '10 hours'),
('5e100000-0000-0000-0000-000000000002', 5.1,  820, 'PENDING', ST_SetSRID(ST_MakePoint(28.8510, 47.0080), 4326), ST_SetSRID(ST_MakePoint(28.8300, 47.0550), 4326), 'bd. Ștefan cel Mare 105, Chișinău',    'bd. Moscova 14, Chișinău',    NOW() + INTERVAL '3 hours',  NOW() + INTERVAL '12 hours'),
('5e100000-0000-0000-0000-000000000003', 1.8,  240, 'PENDING', ST_SetSRID(ST_MakePoint(28.8900, 47.0150), 4326), ST_SetSRID(ST_MakePoint(28.8300, 47.0550), 4326), 'str. Mitropolit Dosoftei 108, Chișinău','bd. Moscova 14, Chișinău',    NOW() + INTERVAL '4 hours',  NOW() + INTERVAL '14 hours'),
('5e100000-0000-0000-0000-00000000000f', 3.2,  510, 'PENDING', ST_SetSRID(ST_MakePoint(28.8780, 47.0130), 4326), ST_SetSRID(ST_MakePoint(28.8300, 47.0550), 4326), 'str. Tighina 42, Chișinău',             'bd. Moscova 14, Chișinău',    NOW() + INTERVAL '2 hours',  NOW() + INTERVAL '8 hours'),
('5e100000-0000-0000-0000-00000000000d', 2.8,  420, 'PENDING', ST_SetSRID(ST_MakePoint(28.8840, 47.0220), 4326), ST_SetSRID(ST_MakePoint(28.8300, 47.0550), 4326), 'str. Alexandru Hâjdeu 55, Chișinău',   'bd. Moscova 14, Chișinău',    NOW() + INTERVAL '5 hours',  NOW() + INTERVAL '15 hours'),
('5e100000-0000-0000-0000-000000000009', 4.7,  740, 'PENDING', ST_SetSRID(ST_MakePoint(28.8720, 47.0070), 4326), ST_SetSRID(ST_MakePoint(28.8300, 47.0550), 4326), 'bd. Renașterii 12, Chișinău',           'bd. Moscova 14, Chișinău',    NOW() + INTERVAL '6 hours',  NOW() + INTERVAL '16 hours'),
('5e100000-0000-0000-0000-00000000000a', 1.5,  190, 'PENDING', ST_SetSRID(ST_MakePoint(28.8950, 47.0340), 4326), ST_SetSRID(ST_MakePoint(28.8300, 47.0550), 4326), 'str. Petricani 6, Chișinău',            'bd. Moscova 14, Chișinău',    NOW() + INTERVAL '3 hours',  NOW() + INTERVAL '11 hours'),
('5e100000-0000-0000-0000-000000000008', 6.3,  980, 'PENDING', ST_SetSRID(ST_MakePoint(28.8310, 47.0180), 4326), ST_SetSRID(ST_MakePoint(28.8300, 47.0550), 4326), 'str. Voluntarilor 32, Chișinău',        'bd. Moscova 14, Chișinău',    NOW() + INTERVAL '4 hours',  NOW() + INTERVAL '13 hours'),
-- ZONA 2: Botanica
('5e100000-0000-0000-0000-000000000004', 3.2,  490, 'PENDING', ST_SetSRID(ST_MakePoint(28.8680, 47.0310), 4326), ST_SetSRID(ST_MakePoint(28.8200, 47.0100), 4326), 'bd. Dacia 50, Chișinău',                'bd. Traian 2, Chișinău',      NOW() + INTERVAL '2 hours',  NOW() + INTERVAL '9 hours'),
('5e100000-0000-0000-0000-000000000005', 4.7,  720, 'PENDING', ST_SetSRID(ST_MakePoint(28.8820, 47.0420), 4326), ST_SetSRID(ST_MakePoint(28.8200, 47.0100), 4326), 'str. Sarmizegetusa 8, Chișinău',        'bd. Traian 2, Chișinău',      NOW() + INTERVAL '3 hours',  NOW() + INTERVAL '12 hours'),
('5e100000-0000-0000-0000-00000000000e', 2.1,  310, 'PENDING', ST_SetSRID(ST_MakePoint(28.8670, 47.0380), 4326), ST_SetSRID(ST_MakePoint(28.8200, 47.0100), 4326), 'str. Barbu Lăutaru 22, Chișinău',       'bd. Traian 2, Chișinău',      NOW() + INTERVAL '4 hours',  NOW() + INTERVAL '14 hours'),
-- ZONA 3: Râșcani
('5e100000-0000-0000-0000-000000000006', 7.5, 1200, 'PENDING', ST_SetSRID(ST_MakePoint(28.8460, 47.0560), 4326), ST_SetSRID(ST_MakePoint(28.9100, 47.0700), 4326), 'str. Florilor 18, Chișinău',            'str. Kiev 50, Chișinău',      NOW() + INTERVAL '5 hours',  NOW() + INTERVAL '15 hours'),
('5e100000-0000-0000-0000-00000000000c', 3.8,  580, 'PENDING', ST_SetSRID(ST_MakePoint(28.8580, 47.0620), 4326), ST_SetSRID(ST_MakePoint(28.9100, 47.0700), 4326), 'str. Bucovinei 25, Chișinău',           'str. Kiev 50, Chișinău',      NOW() + INTERVAL '6 hours',  NOW() + INTERVAL '18 hours'),
-- ZONA 4: Telecentru
('5e100000-0000-0000-0000-000000000007', 2.9,  440, 'PENDING', ST_SetSRID(ST_MakePoint(28.9010, 47.0490), 4326), ST_SetSRID(ST_MakePoint(28.9300, 47.0150), 4326), 'str. Calea Orheiului 78, Chișinău',     'str. Grenoble 110, Chișinău', NOW() + INTERVAL '2 hours',  NOW() + INTERVAL '10 hours'),
-- CLUSTERED (deja grupate)
('5e100000-0000-0000-0000-000000000001', 3.5,  520, 'CLUSTERED', ST_SetSRID(ST_MakePoint(28.8760, 47.0210), 4326), ST_SetSRID(ST_MakePoint(28.8320, 47.0560), 4326), 'str. Armenească 30, Chișinău',       'bd. Moscova 18, Chișinău',    NOW() - INTERVAL '2 hours',  NOW() + INTERVAL '4 hours'),
('5e100000-0000-0000-0000-000000000002', 4.2,  670, 'CLUSTERED', ST_SetSRID(ST_MakePoint(28.8520, 47.0090), 4326), ST_SetSRID(ST_MakePoint(28.8320, 47.0560), 4326), 'bd. Ștefan cel Mare 120, Chișinău',  'bd. Moscova 18, Chișinău',    NOW() - INTERVAL '1 hour',   NOW() + INTERVAL '5 hours'),
-- IN_TRANSIT
('5e100000-0000-0000-0000-000000000003', 5.8,  890, 'IN_TRANSIT', ST_SetSRID(ST_MakePoint(28.8910, 47.0160), 4326), ST_SetSRID(ST_MakePoint(28.8310, 47.0560), 4326), 'str. Mitropolit Dosoftei 115, Chișinău','bd. Moscova 20, Chișinău', NOW() - INTERVAL '3 hours',  NOW() + INTERVAL '1 hour'),
-- DELIVERED
('5e100000-0000-0000-0000-000000000004', 2.2,  340, 'DELIVERED',  ST_SetSRID(ST_MakePoint(28.8690, 47.0320), 4326), ST_SetSRID(ST_MakePoint(28.8210, 47.0110), 4326), 'bd. Dacia 60, Chișinău',             'bd. Traian 8, Chișinău',      NOW() - INTERVAL '48 hours', NOW() - INTERVAL '40 hours'),
('5e100000-0000-0000-0000-000000000005', 6.1,  950, 'DELIVERED',  ST_SetSRID(ST_MakePoint(28.8830, 47.0430), 4326), ST_SetSRID(ST_MakePoint(28.8210, 47.0110), 4326), 'str. Sarmizegetusa 12, Chișinău',    'bd. Traian 8, Chișinău',      NOW() - INTERVAL '24 hours', NOW() - INTERVAL '18 hours'),
-- Bălți
('5e100000-0000-0000-0000-00000000000b', 8.5, 1400, 'PENDING',    ST_SetSRID(ST_MakePoint(27.9380, 47.7540), 4326), ST_SetSRID(ST_MakePoint(27.9100, 47.7800), 4326), 'str. Independenței 45, Bălți',       'str. Decebal 12, Bălți',      NOW() + INTERVAL '6 hours',  NOW() + INTERVAL '24 hours'),
-- CANCELLED
('5e100000-0000-0000-0000-000000000006', 3.0,  460, 'CANCELLED',  ST_SetSRID(ST_MakePoint(28.8470, 47.0570), 4326), ST_SetSRID(ST_MakePoint(28.9110, 47.0710), 4326), 'str. Florilor 20, Chișinău',         'str. Kiev 55, Chișinău',      NOW() - INTERVAL '72 hours', NOW() - INTERVAL '60 hours');

COMMIT;

-- ─── Verificare rapidă ────────────────────────────────────────────────────────
SELECT type, COUNT(*) AS count FROM companies GROUP BY type ORDER BY type;
SELECT status, COUNT(*) AS count, ROUND(SUM(volume_m3)::NUMERIC, 1) AS total_m3 FROM orders GROUP BY status ORDER BY status;
SELECT status, COUNT(*) AS count FROM vehicles GROUP BY status;
