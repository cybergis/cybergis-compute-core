CREATE TABLE `job` (
	`session_id` bigint (20) unsigned NOT NULL,
	`job_id` bigint (20) unsigned NOT NULL,
	`created_at` datetime DEFAULT NOW(),
	`ended_at` datetime DEFAULT NOW(),
	`updated_at` datetime DEFAULT NOW(),
	`deleted_at` datetime DEFAULT NULL,
	`is_crashed` TINYINT (1) NOT NULL,
	`file` varchar (256) NOT NULL,
	`destination` varchar (256) NOT NULL,
	`env` varchar(256) unsigned NOT NULL,
    KEY `idx_fk_session_id` (`session_id`),
    KEY `idx_is_crashed` (`is_crashed`),
    KEY `idx_destination` (`destination`),
    UNIQUE KEY `uniq_job_id` (`job_id`),
	PRIMARY KEY (`job_id`)) ENGINE = InnoDB AUTO_INCREMENT = 4 DEFAULT CHARSET = utf8mb4;

CREATE TABLE `session` (
	`session_id` bigint (20) unsigned NOT NULL,
	`created_at` datetime DEFAULT NOW(),
	`updated_at` datetime DEFAULT NOW(),
	`deleted_at` datetime DEFAULT NULL,
	`email` varchar (256) NOT NULL,
	`secret_token` varchar (256) NOT NULL,
    KEY `idx_fk_session_id` (`session_id`),
    KEY `idx_is_crashed` (`is_crashed`),
    KEY `idx_destination` (`destination`),
    UNIQUE KEY `uniq_job_id` (`job_id`),
	PRIMARY KEY (`job_id`)) ENGINE = InnoDB AUTO_INCREMENT = 4 DEFAULT CHARSET = utf8mb4;
