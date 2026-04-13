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
