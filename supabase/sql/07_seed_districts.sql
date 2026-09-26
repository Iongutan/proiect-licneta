-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v2 — 07: cele 37 de unități administrativ-teritoriale
-- Centrul = orașul-reședință (WGS84).
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.districts (id, name, kind, region, center) values
  ('chisinau',     'Chișinău',        'MUNICIPIU',        'CENTRU', 'SRID=4326;POINT(28.8638 47.0105)'),
  ('balti',        'Bălți',           'MUNICIPIU',        'NORD',   'SRID=4326;POINT(27.9290 47.7617)'),
  ('bender',       'Bender',          'MUNICIPIU',        'SUD',    'SRID=4326;POINT(29.4773 46.8316)'),
  ('briceni',      'Briceni',         'RAION',            'NORD',   'SRID=4326;POINT(27.0845 48.3615)'),
  ('donduseni',    'Dondușeni',       'RAION',            'NORD',   'SRID=4326;POINT(27.5908 48.2233)'),
  ('drochia',      'Drochia',         'RAION',            'NORD',   'SRID=4326;POINT(27.8126 48.0355)'),
  ('edinet',       'Edineț',          'RAION',            'NORD',   'SRID=4326;POINT(27.3053 48.1717)'),
  ('falesti',      'Fălești',         'RAION',            'NORD',   'SRID=4326;POINT(27.7093 47.5732)'),
  ('floresti',     'Florești',        'RAION',            'NORD',   'SRID=4326;POINT(28.2944 47.8913)'),
  ('glodeni',      'Glodeni',         'RAION',            'NORD',   'SRID=4326;POINT(27.5144 47.7708)'),
  ('ocnita',       'Ocnița',          'RAION',            'NORD',   'SRID=4326;POINT(27.4806 48.4108)'),
  ('riscani',      'Rîșcani',         'RAION',            'NORD',   'SRID=4326;POINT(27.5536 47.9575)'),
  ('singerei',     'Sîngerei',        'RAION',            'NORD',   'SRID=4326;POINT(28.1419 47.6353)'),
  ('soldanesti',   'Șoldănești',      'RAION',            'NORD',   'SRID=4326;POINT(28.7969 47.8161)'),
  ('soroca',       'Soroca',          'RAION',            'NORD',   'SRID=4326;POINT(28.2975 48.1558)'),
  ('anenii_noi',   'Anenii Noi',      'RAION',            'CENTRU', 'SRID=4326;POINT(29.2314 46.8797)'),
  ('calarasi',     'Călărași',        'RAION',            'CENTRU', 'SRID=4326;POINT(28.3081 47.2544)'),
  ('criuleni',     'Criuleni',        'RAION',            'CENTRU', 'SRID=4326;POINT(29.1592 47.2139)'),
  ('dubasari',     'Dubăsari',        'RAION',            'CENTRU', 'SRID=4326;POINT(29.1231 47.3016)'),
  ('hincesti',     'Hîncești',        'RAION',            'CENTRU', 'SRID=4326;POINT(28.5906 46.8306)'),
  ('ialoveni',     'Ialoveni',        'RAION',            'CENTRU', 'SRID=4326;POINT(28.7822 46.9431)'),
  ('nisporeni',    'Nisporeni',       'RAION',            'CENTRU', 'SRID=4326;POINT(28.1783 47.0814)'),
  ('orhei',        'Orhei',           'RAION',            'CENTRU', 'SRID=4326;POINT(28.8231 47.3831)'),
  ('rezina',       'Rezina',          'RAION',            'CENTRU', 'SRID=4326;POINT(28.9622 47.7492)'),
  ('straseni',     'Strășeni',        'RAION',            'CENTRU', 'SRID=4326;POINT(28.6103 47.1414)'),
  ('telenesti',    'Telenești',       'RAION',            'CENTRU', 'SRID=4326;POINT(28.3656 47.4997)'),
  ('ungheni',      'Ungheni',         'RAION',            'CENTRU', 'SRID=4326;POINT(27.8006 47.2108)'),
  ('basarabeasca', 'Basarabeasca',    'RAION',            'SUD',    'SRID=4326;POINT(28.9614 46.3336)'),
  ('cahul',        'Cahul',           'RAION',            'SUD',    'SRID=4326;POINT(28.1944 45.9075)'),
  ('cantemir',     'Cantemir',        'RAION',            'SUD',    'SRID=4326;POINT(28.2011 46.2781)'),
  ('causeni',      'Căușeni',         'RAION',            'SUD',    'SRID=4326;POINT(29.4114 46.6442)'),
  ('cimislia',     'Cimișlia',        'RAION',            'SUD',    'SRID=4326;POINT(28.7836 46.5200)'),
  ('leova',        'Leova',           'RAION',            'SUD',    'SRID=4326;POINT(28.2553 46.4786)'),
  ('stefan_voda',  'Ștefan Vodă',     'RAION',            'SUD',    'SRID=4326;POINT(29.6631 46.5128)'),
  ('taraclia',     'Taraclia',        'RAION',            'SUD',    'SRID=4326;POINT(28.6689 45.8986)'),
  ('gagauzia',     'UTA Găgăuzia',    'UTA',              'SUD',    'SRID=4326;POINT(28.6567 46.2956)'),
  ('stinga_nistrului', 'Stânga Nistrului', 'STANGA_NISTRULUI', 'SUD', 'SRID=4326;POINT(29.6433 46.8403)')
on conflict (id) do update set name = excluded.name, kind = excluded.kind, region = excluded.region, center = excluded.center;
