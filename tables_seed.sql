INSERT INTO accounts (user_name, password, origin_country, super_user) VALUES ('admin', '3627909a29c31381a071ec27f7c9ca97726182aed29a7ddd2e54353322cfb30abb9e3a6df2ac2c20fe23436311d678564d0c8d305930575f60e2d3d048184d79', 1, 1);
INSERT INTO accounts (user_name, password, origin_country, super_user) VALUES ('user1', '3627909a29c31381a071ec27f7c9ca97726182aed29a7ddd2e54353322cfb30abb9e3a6df2ac2c20fe23436311d678564d0c8d305930575f60e2d3d048184d79', 1, 0);

INSERT INTO country (country_name) VALUES ('Singapore');
INSERT INTO country (country_name) VALUES ('Malaysia');
INSERT INTO country (country_name) VALUES ('Indonesia');
INSERT INTO country (country_name) VALUES ('Vietnam');
INSERT INTO country (country_name) VALUES ('Philippines');
INSERT INTO country (country_name) VALUES ('Thailand');

INSERT INTO service_name (service_name) VALUES ('BKX3');
INSERT INTO service_name (service_name) VALUES ('BKX1');
INSERT INTO service_name (service_name) VALUES ('SGX');

INSERT INTO port_name (port_name, port_code) VALUES ('LAEMCHABANG', 'THLCH');
INSERT INTO port_name (port_name, port_code) VALUES ('BANGKOK', 'THBKK');
INSERT INTO port_name (port_name, port_code) VALUES ('SONGKLA', 'THSGZ');
INSERT INTO port_name (port_name, port_code) VALUES ('KUANTAN', 'MYKUA');

INSERT INTO vessel_name (vessel_name, TEU, TONS) VALUES ('SINAR BINTAN', 893, 12500);
INSERT INTO vessel_name (vessel_name, TEU, TONS) VALUES ('SINAR BANDUNG', 893, 12500);
INSERT INTO vessel_name (vessel_name, TEU, TONS) VALUES ('SINAR SOLO' , 893, 12500);
INSERT INTO vessel_name (vessel_name, TEU, TONS) VALUES ('KOTA HANDAL' , 320, 4480);
INSERT INTO vessel_name (vessel_name, TEU, TONS) VALUES ('CHERRY' , 926, 14000);
INSERT INTO vessel_name (vessel_name, TEU, TONS) VALUES ('ALS SUMIRE' , 903, 14000);

INSERT INTO customers (customer_name, op_code) VALUES ('ONE', 'ON');
INSERT INTO customers (customer_name, op_code) VALUES ('ACL', 'AV');
INSERT INTO customers (customer_name, op_code) VALUES ('CMA', 'CM');
INSERT INTO customers (customer_name, op_code) VALUES ('CMA', 'CX');
INSERT INTO customers (customer_name, op_code) VALUES ('CMA', 'AL');
INSERT INTO customers (customer_name, op_code) VALUES ('PENEX', 'LV');
INSERT INTO customers (customer_name, op_code) VALUES ('COSCO', 'CC');
INSERT INTO customers (customer_name, op_code) VALUES ('COSCO', 'CK');
INSERT INTO customers (customer_name, op_code) VALUES ('OOCL', 'OR');

INSERT INTO container_sizes (size) VALUES ('20');
INSERT INTO container_sizes (size) VALUES ('40');
INSERT INTO container_sizes (size) VALUES ('45');
INSERT INTO container_sizes (size) VALUES ('40hc');
INSERT INTO container_sizes (size) VALUES ('45hc');

INSERT INTO container_types (type) VALUES ('Laden');
INSERT INTO container_types (type) VALUES ('Empty');
INSERT INTO container_types (type) VALUES ('DG');
INSERT INTO container_types (type) VALUES ('Reefer');