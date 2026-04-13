-- Production Lines
CREATE TABLE IF NOT EXISTS lines (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  machines INTEGER NOT NULL,
  operators INTEGER NOT NULL
);

INSERT OR IGNORE INTO lines VALUES (1,'Danube',55,42);
INSERT OR IGNORE INTO lines VALUES (2,'Maritsa',10,28);
INSERT OR IGNORE INTO lines VALUES (3,'Iskar',2,35);
INSERT OR IGNORE INTO lines VALUES (4,'Rhine',160,22);
INSERT OR IGNORE INTO lines VALUES (5,'Main',15,18);

-- Production Load (units/day per line per week)
CREATE TABLE IF NOT EXISTS production_load (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_id INTEGER NOT NULL,
  week TEXT NOT NULL,
  planned INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (line_id) REFERENCES lines(id),
  UNIQUE(line_id, week)
);

-- OEE per line per week
CREATE TABLE IF NOT EXISTS oee (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_id INTEGER NOT NULL,
  week TEXT NOT NULL,
  oee_percent REAL NOT NULL DEFAULT 0,
  active_machines INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (line_id) REFERENCES lines(id),
  UNIQUE(line_id, week)
);

-- Headcount & Absence
CREATE TABLE IF NOT EXISTS headcount (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_id INTEGER NOT NULL,
  week TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  absent INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (line_id) REFERENCES lines(id),
  UNIQUE(line_id, week)
);

-- Operators & Certifications
CREATE TABLE IF NOT EXISTS operators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  line_id INTEGER NOT NULL,
  cert_expiry TEXT,
  FOREIGN KEY (line_id) REFERENCES lines(id)
);

-- Seed: Production Load (4 weeks of demo data)
INSERT OR IGNORE INTO production_load (line_id, week, planned, capacity) VALUES
  (1,'2026-W13',750,1000),(2,'2026-W13',380,500),(3,'2026-W13',150,200),(4,'2026-W13',2200,3000),(5,'2026-W13',600,800),
  (1,'2026-W14',820,1000),(2,'2026-W14',420,500),(3,'2026-W14',165,200),(4,'2026-W14',2450,3000),(5,'2026-W14',650,800),
  (1,'2026-W15',870,1000),(2,'2026-W15',445,500),(3,'2026-W15',175,200),(4,'2026-W15',2620,3000),(5,'2026-W15',700,800),
  (1,'2026-W16',910,1000),(2,'2026-W16',470,500),(3,'2026-W16',185,200),(4,'2026-W16',2760,3000),(5,'2026-W16',740,800);

-- Seed: OEE
INSERT OR IGNORE INTO oee (line_id, week, oee_percent, active_machines) VALUES
  (1,'2026-W13',72,48),(2,'2026-W13',68,8),(3,'2026-W13',82,2),(4,'2026-W13',65,138),(5,'2026-W13',78,13),
  (1,'2026-W14',75,50),(2,'2026-W14',71,9),(3,'2026-W14',80,2),(4,'2026-W14',68,144),(5,'2026-W14',80,14),
  (1,'2026-W15',78,52),(2,'2026-W15',74,9),(3,'2026-W15',83,2),(4,'2026-W15',70,150),(5,'2026-W15',82,14),
  (1,'2026-W16',81,53),(2,'2026-W16',76,10),(3,'2026-W16',85,2),(4,'2026-W16',73,156),(5,'2026-W16',84,15);

-- Seed: Headcount
INSERT OR IGNORE INTO headcount (line_id, week, total, absent) VALUES
  (1,'2026-W13',42,4),(2,'2026-W13',28,2),(3,'2026-W13',35,3),(4,'2026-W13',22,2),(5,'2026-W13',18,1),
  (1,'2026-W14',42,3),(2,'2026-W14',28,2),(3,'2026-W14',35,2),(4,'2026-W14',22,1),(5,'2026-W14',18,1),
  (1,'2026-W15',42,5),(2,'2026-W15',28,3),(3,'2026-W15',35,4),(4,'2026-W15',22,2),(5,'2026-W15',18,2),
  (1,'2026-W16',42,3),(2,'2026-W16',28,1),(3,'2026-W16',35,2),(4,'2026-W16',22,1),(5,'2026-W16',18,1);

-- Seed: Operators with certifications
INSERT OR IGNORE INTO operators (id, name, line_id, cert_expiry) VALUES
  (1,'Ivan Petrov',1,'2026-08-15'),(2,'Maria Georgieva',1,'2026-03-10'),
  (3,'Stefan Dimitrov',1,'2027-01-20'),(4,'Elena Todorova',2,'2026-05-30'),
  (5,'Georgi Nikolov',2,'2025-12-01'),(6,'Yana Stoyanova',2,'2026-11-14'),
  (7,'Plamen Ivanov',3,'2026-06-22'),(8,'Nadya Kostadinova',3,'2026-09-05'),
  (9,'Hristo Vasilev',4,'2025-11-20'),(10,'Vesela Angelova',4,'2026-04-02'),
  (11,'Deyan Marinov',4,'2026-12-31'),(12,'Tsvetelina Ranova',5,'2026-07-18'),
  (13,'Boyan Stanchev',5,'2026-02-28');
