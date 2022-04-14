CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL NOT NULL PRIMARY KEY, 
  user_name TEXT,
  password TEXT, 
  origin_country INTEGER, 
  super_user INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL NOT NULL PRIMARY KEY,
  customer_name TEXT,
  op_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS loadings (
    id SERIAL NOT NULL PRIMARY KEY,
    customer_name INTEGER,
    vessel_name INTEGER,
    voyage_number INTEGER,
    user_name INTEGER,
    pol VARCHAR(5),
    pod VARCHAR(5),
    date DATE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS loading_containers (
    id SERIAL NOT NULL PRIMARY KEY,
    container_size INTEGER,
    container_type INTEGER,
    amt_of_containers INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS container_sizes (
  id SERIAL NOT NULL PRIMARY KEY,
  size TEXT  
 );

CREATE TABLE IF NOT EXISTS container_types (
    id SERIAL NOT NULL PRIMARY KEY,
   type TEXT
 );

CREATE TABLE IF NOT EXISTS vessel_voyage (
    id SERIAL NOT NULL PRIMARY KEY,
    vessel_name INTEGER,
    voyage_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );

CREATE TABLE IF NOT EXISTS vessel_schedule (
    id SERIAL NOT NULL PRIMARY KEY,
    vessel_name INTEGER,
    voyage_number INTEGER,
    service_name INTEGER,
    port_name INTEGER,
    ETA date,
    ETD date,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );

CREATE TABLE IF NOT EXISTS vessel_name (
    id SERIAL NOT NULL PRIMARY KEY,
    vessel_name TEXT,
    TEU INTEGER,
    TONS INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );

CREATE TABLE IF NOT EXISTS country (
    id SERIAL NOT NULL PRIMARY KEY,
    country_name TEXT
 );

CREATE TABLE IF NOT EXISTS service_name (
    id SERIAL NOT NULL PRIMARY KEY,
    service_name TEXT
 );

CREATE TABLE IF NOT EXISTS port_name (
    id SERIAL NOT NULL PRIMARY KEY,
    port_name TEXT,
    port_code VARCHAR(5)
 );
 
CREATE TABLE IF NOT EXISTS vessel_alloc_at_port (
    id SERIAL NOT NULL PRIMARY KEY,
    service_name INTEGER,
    port_name INTEGER,
    country_name INTEGER,
    vessel_name INTEGER,
    TEU INTEGER,
    TONS INTEGER
 );






