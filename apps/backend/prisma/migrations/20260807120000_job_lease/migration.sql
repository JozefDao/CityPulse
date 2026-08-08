-- CreateTable
CREATE TABLE `JobLease` (
  `name` VARCHAR(64) NOT NULL,
  `token` VARCHAR(64) NULL,
  `expiresAt` DATETIME(3) NULL,

  PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
