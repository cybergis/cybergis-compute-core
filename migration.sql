DROP TABLE IF EXISTS `jobs`;
CREATE TABLE `jobs` (
  `id` varchar(255) NOT NULL,
  `userId` varchar(255) DEFAULT NULL,
  `secretToken` varchar(255) NOT NULL,
  `maintainer` varchar(255) NOT NULL,
  `hpc` varchar(255) NOT NULL,
  `executableFolder` varchar(255) DEFAULT NULL,
  `dataFolder` varchar(255) DEFAULT NULL,
  `resultFolder` varchar(255) DEFAULT NULL,
  `param` text NOT NULL,
  `env` text NOT NULL,
  `slurm` text,
  `credentialId` varchar(255) DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `deletedAt` timestamp NULL DEFAULT NULL,
  `initializedAt` timestamp NULL DEFAULT NULL,
  `finishedAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `logs`;
CREATE TABLE `logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `jobId` varchar(255) NOT NULL,
  `message` varchar(255) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deletedAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_16c9f776ef091dad5e68ca4e37e` (`jobId`),
  CONSTRAINT `FK_16c9f776ef091dad5e68ca4e37e` FOREIGN KEY (`jobId`) REFERENCES `jobs` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `events`;
CREATE TABLE `events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `jobId` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `message` varchar(255) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deletedAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_88cd839d619ba5c30cc393560c5` (`jobId`),
  CONSTRAINT `FK_88cd839d619ba5c30cc393560c5` FOREIGN KEY (`jobId`) REFERENCES `jobs` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;