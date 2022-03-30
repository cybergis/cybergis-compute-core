docker exec -it <DB_Container_ID> bash

mysql --user=cybergis_compute --password cybergis_compute

SELECT database();

USE cybergis_compute

SHOW TABLES;

select * from gits;

INSERT INTO `gits` (`id`, `address`, `sha`, `isApproved`, `createdAt`, `updatedAt`, `deletedAt`) VALUES
('wrfhydro-5.x', 'https://github.com/cybergis/cybergis-compute-v2-wrfhydro.git', NULL, 1, '2022-03-04 19:28:50', '2022-03-04 19:28:50', NULL);

select * from globus_transfer_refresh_token;

INSERT INTO `globus_transfer_refresh_token` (`identity`, `transferRefreshToken`, `createdAt`, `updatedAt`, `deletedAt`) VALUES
('apadmana@illinois.edu', 'XXXXXXXXXXXXXX', '2022-03-29 19:28:50', '2022-03-29 19:28:50', NULL);


exit

check:
https://cgjobsup.cigi.illinois.edu/v2/git
