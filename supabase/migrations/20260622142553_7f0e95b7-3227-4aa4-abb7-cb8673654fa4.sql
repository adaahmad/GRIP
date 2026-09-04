
INSERT INTO public.regions (slug, name, country, topography, lat, lon, description) VALUES
-- Alpine
('queenstown','Queenstown','New Zealand','alpine',-45.0312,168.6626,'Southern Alps ski & adventure hub.'),
('banff','Banff','Canada','alpine',51.1784,-115.5708,'Canadian Rockies tourism economy.'),
('niseko','Niseko','Japan','alpine',42.8047,140.6874,'Hokkaido powder-snow resort cluster.'),
-- Desert
('dubai','Dubai','UAE','desert',25.2048,55.2708,'Hyper-arid coastal megacity.'),
('alice-springs','Alice Springs','Australia','desert',-23.6980,133.8807,'Central desert outpost, extreme heat.'),
('marrakech','Marrakech','Morocco','desert',31.6295,-7.9811,'Pre-Saharan tourism centre.'),
-- Coastal
('venice','Venice','Italy','coastal',45.4408,12.3155,'Lagoon city with acute SLR exposure.'),
('lagos','Lagos','Nigeria','coastal',6.5244,3.3792,'West African megacity on low-lying coast.'),
('cape-town','Cape Town','South Africa','coastal',-33.9249,18.4241,'Two-ocean coastal metro.'),
-- Tropical delta
('dhaka','Dhaka','Bangladesh','tropical-delta',23.8103,90.4125,'Ganges-Brahmaputra delta megacity.'),
('manila','Manila','Philippines','tropical-delta',14.5995,120.9842,'Typhoon-exposed delta capital.'),
('new-orleans','New Orleans','USA','tropical-delta',29.9511,-90.0715,'Mississippi delta, levee-dependent.'),
-- Savanna
('nairobi','Nairobi','Kenya','savanna',-1.2921,36.8219,'East African highland savanna metro.'),
('kruger-lowveld','Kruger Lowveld','South Africa','savanna',-24.0000,31.5000,'Bushveld park & agriculture mosaic.'),
('darwin','Darwin','Australia','savanna',-12.4634,130.8456,'Tropical-savanna northern capital.'),
-- Boreal
('yakutsk','Yakutsk','Russia','boreal',62.0339,129.7331,'Coldest major city, permafrost-built.'),
('fairbanks','Fairbanks','USA','boreal',64.8378,-147.7164,'Interior Alaska, fire & thaw exposure.'),
('whitehorse','Whitehorse','Canada','boreal',60.7212,-135.0568,'Yukon capital, boreal forest matrix.'),
('rovaniemi','Rovaniemi','Finland','boreal',66.5039,25.7294,'Arctic-circle Lapland hub.')
ON CONFLICT (slug) DO NOTHING;
