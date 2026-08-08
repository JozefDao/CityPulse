-- Repairs schema changes that historically reached existing databases outside
-- Prisma Migrate. The checks intentionally accept only the known legacy and
-- current definitions; an unknown definition fails before any data update.
--
-- This uses INFORMATION_SCHEMA plus session-scoped PREPARE/EXECUTE rather than
-- stored procedures so the migration can be applied to MySQL 8 and TiDB.

-- User.nickname: add a nullable staging column when it is absent.
SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(`DATA_TYPE`) = 'varchar'
      AND MAX(`CHARACTER_MAXIMUM_LENGTH`) = 191 THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'User'
    AND `COLUMN_NAME` = 'nickname'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'ALTER TABLE `User` ADD COLUMN `nickname` VARCHAR(191) NULL'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_User_nickname'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

-- UserCity.sortOrder.
SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(`DATA_TYPE`) = 'int'
      AND MAX(`IS_NULLABLE`) = 'NO'
      AND MAX(CAST(`COLUMN_DEFAULT` AS CHAR)) = '0' THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'UserCity'
    AND `COLUMN_NAME` = 'sortOrder'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'ALTER TABLE `UserCity` ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_UserCity_sortOrder'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

-- Article moderation metadata. moderationStatus remains nullable until the
-- approved legacy backfill has completed.
SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(`DATA_TYPE`) = 'varchar'
      AND MAX(`CHARACTER_MAXIMUM_LENGTH`) = 191
      AND MAX(`IS_NULLABLE`) = 'YES'
      AND MAX(`COLUMN_DEFAULT`) IS NULL THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'Article'
    AND `COLUMN_NAME` = 'flagCategory'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'ALTER TABLE `Article` ADD COLUMN `flagCategory` VARCHAR(191) NULL'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_Article_flagCategory'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(`COLUMN_TYPE`) = 'enum(\'LOW\',\'MEDIUM\',\'HIGH\')'
      AND MAX(`IS_NULLABLE`) = 'YES'
      AND MAX(`COLUMN_DEFAULT`) IS NULL THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'Article'
    AND `COLUMN_NAME` = 'flagSeverity'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'ALTER TABLE `Article` ADD COLUMN `flagSeverity` ENUM(\'LOW\', \'MEDIUM\', \'HIGH\') NULL'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_Article_flagSeverity'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(`COLUMN_TYPE`) = 'enum(\'CLEAN\',\'EXPLICIT\',\'BLOCKED\')' THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'Article'
    AND `COLUMN_NAME` = 'moderationStatus'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'ALTER TABLE `Article` ADD COLUMN `moderationStatus` ENUM(\'CLEAN\', \'EXPLICIT\', \'BLOCKED\') NULL'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_Article_moderationStatus'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

-- ArticleComment moderation metadata.
SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(`DATA_TYPE`) = 'varchar'
      AND MAX(`CHARACTER_MAXIMUM_LENGTH`) = 191
      AND MAX(`IS_NULLABLE`) = 'YES'
      AND MAX(`COLUMN_DEFAULT`) IS NULL THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'ArticleComment'
    AND `COLUMN_NAME` = 'flagCategory'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'ALTER TABLE `ArticleComment` ADD COLUMN `flagCategory` VARCHAR(191) NULL'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_ArticleComment_flagCategory'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(`COLUMN_TYPE`) = 'enum(\'LOW\',\'MEDIUM\',\'HIGH\')'
      AND MAX(`IS_NULLABLE`) = 'YES'
      AND MAX(`COLUMN_DEFAULT`) IS NULL THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'ArticleComment'
    AND `COLUMN_NAME` = 'flagSeverity'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'ALTER TABLE `ArticleComment` ADD COLUMN `flagSeverity` ENUM(\'LOW\', \'MEDIUM\', \'HIGH\') NULL'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_ArticleComment_flagSeverity'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(`DATA_TYPE`) = 'varchar'
      AND MAX(`CHARACTER_MAXIMUM_LENGTH`) = 191
      AND MAX(`IS_NULLABLE`) = 'YES'
      AND MAX(`COLUMN_DEFAULT`) IS NULL THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'ArticleComment'
    AND `COLUMN_NAME` = 'flagReason'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'ALTER TABLE `ArticleComment` ADD COLUMN `flagReason` VARCHAR(191) NULL'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_ArticleComment_flagReason'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

-- Create the two historically untracked tables. IF NOT EXISTS is supported by
-- both MySQL 8 and TiDB; their exact known shape is checked below.
CREATE TABLE IF NOT EXISTS `ModerationAuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `commentId` VARCHAR(191) NOT NULL,
  `adminId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `previousIsFlagged` BOOLEAN NOT NULL,
  `nextIsFlagged` BOOLEAN NOT NULL,
  `previousCategory` VARCHAR(191) NULL,
  `nextCategory` VARCHAR(191) NULL,
  `previousSeverity` ENUM('LOW', 'MEDIUM', 'HIGH') NULL,
  `nextSeverity` ENUM('LOW', 'MEDIUM', 'HIGH') NULL,
  `previousReason` VARCHAR(191) NULL,
  `nextReason` VARCHAR(191) NULL,
  `note` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ModerationAuditLog_commentId_createdAt_idx`(`commentId`, `createdAt`),
  INDEX `ModerationAuditLog_adminId_createdAt_idx`(`adminId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ModerationAuditLog_commentId_fkey`
    FOREIGN KEY (`commentId`) REFERENCES `ArticleComment`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ModerationAuditLog_adminId_fkey`
    FOREIGN KEY (`adminId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SupportRequest` (
  `id` VARCHAR(191) NOT NULL,
  `senderId` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `SupportRequest_senderId_createdAt_idx`(`senderId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupportRequest_senderId_fkey`
    FOREIGN KEY (`senderId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- All data guards run before either approved data backfill.
-- The approved Article backfill is meaningful only for the historical boolean
-- source column. Any other definition is an unknown schema drift and aborts.
SET @cp_state = COALESCE((
  SELECT CASE
    WHEN `DATA_TYPE` = 'tinyint'
      AND `COLUMN_TYPE` = 'tinyint(1)'
      AND `IS_NULLABLE` = 'NO'
      AND CAST(`COLUMN_DEFAULT` AS CHAR) = '0'
      AND COALESCE(`EXTRA`, '') = '' THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'Article'
    AND `COLUMN_NAME` = 'isFlagged'
), 2);
SET @cp_sql = CASE @cp_state
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_Article_isFlagged'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_invalid_nickname_count = (
  SELECT COUNT(*)
  FROM `User`
  WHERE `nickname` IS NOT NULL
    AND (
      CHAR_LENGTH(`nickname`) < 3
      OR CHAR_LENGTH(`nickname`) > 24
      OR `nickname` NOT REGEXP '^[A-Za-z0-9_]+$'
    )
);
SET @cp_sql = IF(
  @cp_invalid_nickname_count = 0,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_invalid_existing_nickname'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_nickname_collision_count = (
  SELECT COUNT(*)
  FROM (
    SELECT `candidate`
    FROM (
      SELECT `nickname` AS `candidate`
      FROM `User`
      WHERE `nickname` IS NOT NULL
      UNION ALL
      SELECT CONCAT('legacy_', LEFT(SHA2(`id`, 256), 17)) AS `candidate`
      FROM `User`
      WHERE `nickname` IS NULL
    ) AS `cp_nickname_candidates`
    GROUP BY `candidate`
    HAVING COUNT(*) > 1
  ) AS `cp_nickname_collisions`
);
SET @cp_sql = IF(
  @cp_nickname_collision_count = 0,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_nickname_collision'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_invalid_article_flag_count = (
  SELECT COUNT(*)
  FROM `Article`
  WHERE `isFlagged` IS NULL
     OR `isFlagged` NOT IN (0, 1)
     OR (`flagSeverity` IS NOT NULL AND `flagSeverity` NOT IN ('LOW', 'MEDIUM', 'HIGH'))
     OR (
       `moderationStatus` IS NOT NULL
       AND `moderationStatus` NOT IN ('CLEAN', 'EXPLICIT', 'BLOCKED')
     )
);
SET @cp_sql = IF(
  @cp_invalid_article_flag_count = 0,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_invalid_Article_moderation_data'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_invalid_comment_flag_count = (
  SELECT COUNT(*)
  FROM `ArticleComment`
  WHERE `flagSeverity` IS NOT NULL
    AND `flagSeverity` NOT IN ('LOW', 'MEDIUM', 'HIGH')
);
SET @cp_sql = IF(
  @cp_invalid_comment_flag_count = 0,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_invalid_ArticleComment_moderation_data'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

-- Validate the known existing definitions of tables which might already exist
-- in schema-drifted databases. A partial or incompatible table aborts.
SET @cp_moderation_columns_valid = (
  SELECT CASE
    WHEN COUNT(*) = 14
      AND SUM(CASE WHEN `COLUMN_NAME` = 'id' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'NO' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'commentId' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'NO' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'adminId' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'NO' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'action' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'NO' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'previousIsFlagged' AND `DATA_TYPE` = 'tinyint' AND `IS_NULLABLE` = 'NO' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'nextIsFlagged' AND `DATA_TYPE` = 'tinyint' AND `IS_NULLABLE` = 'NO' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'previousCategory' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'YES' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'nextCategory' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'YES' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'previousSeverity' AND `COLUMN_TYPE` = 'enum(\'LOW\',\'MEDIUM\',\'HIGH\')' AND `IS_NULLABLE` = 'YES' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'nextSeverity' AND `COLUMN_TYPE` = 'enum(\'LOW\',\'MEDIUM\',\'HIGH\')' AND `IS_NULLABLE` = 'YES' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'previousReason' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'YES' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'nextReason' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'YES' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'note' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'YES' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'createdAt' AND `DATA_TYPE` = 'datetime' AND `DATETIME_PRECISION` = 3 AND `IS_NULLABLE` = 'NO' AND LOWER(CAST(`COLUMN_DEFAULT` AS CHAR)) LIKE 'current_timestamp%' THEN 1 ELSE 0 END) = 1
      THEN 1
    ELSE 0
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'ModerationAuditLog'
);
SET @cp_sql = IF(
  @cp_moderation_columns_valid = 1,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_ModerationAuditLog_columns'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_support_columns_valid = (
  SELECT CASE
    WHEN COUNT(*) = 5
      AND SUM(CASE WHEN `COLUMN_NAME` = 'id' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'NO' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'senderId' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'NO' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'subject' AND `DATA_TYPE` = 'varchar' AND `CHARACTER_MAXIMUM_LENGTH` = 191 AND `IS_NULLABLE` = 'NO' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'message' AND `DATA_TYPE` = 'text' AND `IS_NULLABLE` = 'NO' AND `COLUMN_DEFAULT` IS NULL THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN `COLUMN_NAME` = 'createdAt' AND `DATA_TYPE` = 'datetime' AND `DATETIME_PRECISION` = 3 AND `IS_NULLABLE` = 'NO' AND LOWER(CAST(`COLUMN_DEFAULT` AS CHAR)) LIKE 'current_timestamp%' THEN 1 ELSE 0 END) = 1
      THEN 1
    ELSE 0
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'SupportRequest'
);
SET @cp_sql = IF(
  @cp_support_columns_valid = 1,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_SupportRequest_columns'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

-- Validate / add every missing named index. An existing index with the same
-- name but a different definition intentionally aborts.
SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(CAST(`NON_UNIQUE` AS CHAR)) = '0'
      AND MAX(`SEQ_IN_INDEX`) = 1
      AND MAX(`COLUMN_NAME`) = 'nickname' THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`STATISTICS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'User'
    AND `INDEX_NAME` = 'User_nickname_key'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'CREATE UNIQUE INDEX `User_nickname_key` ON `User`(`nickname`)'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_User_nickname_key'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 2
      AND SUM(CASE WHEN CAST(`NON_UNIQUE` AS CHAR) = '1' AND `SEQ_IN_INDEX` = 1 AND `COLUMN_NAME` = 'userId' THEN 1 ELSE 0 END) = 1
      AND SUM(CASE WHEN CAST(`NON_UNIQUE` AS CHAR) = '1' AND `SEQ_IN_INDEX` = 2 AND `COLUMN_NAME` = 'sortOrder' THEN 1 ELSE 0 END) = 1 THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`STATISTICS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'UserCity'
    AND `INDEX_NAME` = 'UserCity_userId_sortOrder_idx'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'CREATE INDEX `UserCity_userId_sortOrder_idx` ON `UserCity`(`userId`, `sortOrder`)'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_UserCity_userId_sortOrder_idx'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(CAST(`NON_UNIQUE` AS CHAR)) = '1'
      AND MAX(`SEQ_IN_INDEX`) = 1
      AND MAX(`COLUMN_NAME`) = 'flagSeverity' THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`STATISTICS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'Article'
    AND `INDEX_NAME` = 'Article_flagSeverity_idx'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'CREATE INDEX `Article_flagSeverity_idx` ON `Article`(`flagSeverity`)'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_Article_flagSeverity_idx'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(CAST(`NON_UNIQUE` AS CHAR)) = '1'
      AND MAX(`SEQ_IN_INDEX`) = 1
      AND MAX(`COLUMN_NAME`) = 'moderationStatus' THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`STATISTICS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'Article'
    AND `INDEX_NAME` = 'Article_moderationStatus_idx'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'CREATE INDEX `Article_moderationStatus_idx` ON `Article`(`moderationStatus`)'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_Article_moderationStatus_idx'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    WHEN COUNT(*) = 1
      AND MAX(CAST(`NON_UNIQUE` AS CHAR)) = '1'
      AND MAX(`SEQ_IN_INDEX`) = 1
      AND MAX(`COLUMN_NAME`) = 'flagSeverity' THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`STATISTICS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'ArticleComment'
    AND `INDEX_NAME` = 'ArticleComment_flagSeverity_idx'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'CREATE INDEX `ArticleComment_flagSeverity_idx` ON `ArticleComment`(`flagSeverity`)'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_ArticleComment_flagSeverity_idx'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

-- Verify the known indexes and foreign keys for pre-existing correction tables.
SET @cp_moderation_indexes_valid = (
  SELECT CASE WHEN
    (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'ModerationAuditLog' AND `INDEX_NAME` = 'PRIMARY' AND `SEQ_IN_INDEX` = 1 AND `COLUMN_NAME` = 'id' AND CAST(`NON_UNIQUE` AS CHAR) = '0') = 1
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'ModerationAuditLog' AND `INDEX_NAME` = 'ModerationAuditLog_commentId_createdAt_idx') = 2
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'ModerationAuditLog' AND `INDEX_NAME` = 'ModerationAuditLog_commentId_createdAt_idx' AND `SEQ_IN_INDEX` = 1 AND `COLUMN_NAME` = 'commentId' AND CAST(`NON_UNIQUE` AS CHAR) = '1') = 1
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'ModerationAuditLog' AND `INDEX_NAME` = 'ModerationAuditLog_commentId_createdAt_idx' AND `SEQ_IN_INDEX` = 2 AND `COLUMN_NAME` = 'createdAt' AND CAST(`NON_UNIQUE` AS CHAR) = '1') = 1
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'ModerationAuditLog' AND `INDEX_NAME` = 'ModerationAuditLog_adminId_createdAt_idx') = 2
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'ModerationAuditLog' AND `INDEX_NAME` = 'ModerationAuditLog_adminId_createdAt_idx' AND `SEQ_IN_INDEX` = 1 AND `COLUMN_NAME` = 'adminId' AND CAST(`NON_UNIQUE` AS CHAR) = '1') = 1
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'ModerationAuditLog' AND `INDEX_NAME` = 'ModerationAuditLog_adminId_createdAt_idx' AND `SEQ_IN_INDEX` = 2 AND `COLUMN_NAME` = 'createdAt' AND CAST(`NON_UNIQUE` AS CHAR) = '1') = 1
  THEN 1 ELSE 0 END
);
SET @cp_sql = IF(
  @cp_moderation_indexes_valid = 1,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_ModerationAuditLog_indexes'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_support_indexes_valid = (
  SELECT CASE WHEN
    (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'SupportRequest' AND `INDEX_NAME` = 'PRIMARY' AND `SEQ_IN_INDEX` = 1 AND `COLUMN_NAME` = 'id' AND CAST(`NON_UNIQUE` AS CHAR) = '0') = 1
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'SupportRequest' AND `INDEX_NAME` = 'SupportRequest_senderId_createdAt_idx') = 2
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'SupportRequest' AND `INDEX_NAME` = 'SupportRequest_senderId_createdAt_idx' AND `SEQ_IN_INDEX` = 1 AND `COLUMN_NAME` = 'senderId' AND CAST(`NON_UNIQUE` AS CHAR) = '1') = 1
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'SupportRequest' AND `INDEX_NAME` = 'SupportRequest_senderId_createdAt_idx' AND `SEQ_IN_INDEX` = 2 AND `COLUMN_NAME` = 'createdAt' AND CAST(`NON_UNIQUE` AS CHAR) = '1') = 1
  THEN 1 ELSE 0 END
);
SET @cp_sql = IF(
  @cp_support_indexes_valid = 1,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_SupportRequest_indexes'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_moderation_fks_valid = (
  SELECT CASE WHEN
    (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'ModerationAuditLog' AND `CONSTRAINT_NAME` = 'ModerationAuditLog_commentId_fkey' AND `COLUMN_NAME` = 'commentId' AND `REFERENCED_TABLE_NAME` = 'ArticleComment' AND `REFERENCED_COLUMN_NAME` = 'id') = 1
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`REFERENTIAL_CONSTRAINTS` WHERE `CONSTRAINT_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'ModerationAuditLog' AND `CONSTRAINT_NAME` = 'ModerationAuditLog_commentId_fkey' AND `UPDATE_RULE` = 'CASCADE' AND `DELETE_RULE` = 'CASCADE') = 1
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'ModerationAuditLog' AND `CONSTRAINT_NAME` = 'ModerationAuditLog_adminId_fkey' AND `COLUMN_NAME` = 'adminId' AND `REFERENCED_TABLE_NAME` = 'User' AND `REFERENCED_COLUMN_NAME` = 'id') = 1
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`REFERENTIAL_CONSTRAINTS` WHERE `CONSTRAINT_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'ModerationAuditLog' AND `CONSTRAINT_NAME` = 'ModerationAuditLog_adminId_fkey' AND `UPDATE_RULE` = 'CASCADE' AND `DELETE_RULE` = 'CASCADE') = 1
  THEN 1 ELSE 0 END
);
SET @cp_sql = IF(
  @cp_moderation_fks_valid = 1,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_ModerationAuditLog_foreign_keys'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_support_fks_valid = (
  SELECT CASE WHEN
    (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'SupportRequest' AND `CONSTRAINT_NAME` = 'SupportRequest_senderId_fkey' AND `COLUMN_NAME` = 'senderId' AND `REFERENCED_TABLE_NAME` = 'User' AND `REFERENCED_COLUMN_NAME` = 'id') = 1
    AND (SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`REFERENTIAL_CONSTRAINTS` WHERE `CONSTRAINT_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'SupportRequest' AND `CONSTRAINT_NAME` = 'SupportRequest_senderId_fkey' AND `UPDATE_RULE` = 'CASCADE' AND `DELETE_RULE` = 'CASCADE') = 1
  THEN 1 ELSE 0 END
);
SET @cp_sql = IF(
  @cp_support_fks_valid = 1,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_SupportRequest_foreign_key'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

-- The old User.updatedAt ON UPDATE clause must be removed before the nickname
-- update below, otherwise MySQL would change every legacy user's timestamp.
SET @cp_state = COALESCE((
  SELECT CASE
    WHEN `DATA_TYPE` = 'datetime'
      AND `DATETIME_PRECISION` = 3
      AND `IS_NULLABLE` = 'NO'
      AND `COLUMN_DEFAULT` IS NULL
      AND COALESCE(`EXTRA`, '') = '' THEN 1
    WHEN `DATA_TYPE` = 'datetime'
      AND `DATETIME_PRECISION` = 3
      AND `IS_NULLABLE` = 'NO'
      AND (
        (
          `COLUMN_DEFAULT` IS NULL
          AND LOWER(COALESCE(`EXTRA`, '')) =
            'default_generated on update current_timestamp(3)'
        )
        OR (
          LOWER(CAST(`COLUMN_DEFAULT` AS CHAR)) = 'current_timestamp(3)'
          AND LOWER(COALESCE(`EXTRA`, '')) IN (
            'default_generated on update current_timestamp(3)',
            'on update current_timestamp(3)'
          )
        )
      ) THEN 0
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'User'
    AND `COLUMN_NAME` = 'updatedAt'
), 2);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'ALTER TABLE `User` MODIFY `updatedAt` DATETIME(3) NOT NULL'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_User_updatedAt'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

-- Apply only the approved, deterministic legacy value to rows that truly have
-- no nickname. Existing non-NULL values have already been validated above.
UPDATE `User`
SET `nickname` = CONCAT('legacy_', LEFT(SHA2(`id`, 256), 17))
WHERE `nickname` IS NULL;

SET @cp_missing_nickname_count = (
  SELECT COUNT(*) FROM `User` WHERE `nickname` IS NULL
);
SET @cp_sql = IF(
  @cp_missing_nickname_count = 0,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_missing_nickname'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 1
      AND MAX(`DATA_TYPE`) = 'varchar'
      AND MAX(`CHARACTER_MAXIMUM_LENGTH`) = 191
      AND MAX(`IS_NULLABLE`) = 'YES'
      AND MAX(`COLUMN_DEFAULT`) IS NULL THEN 0
    WHEN COUNT(*) = 1
      AND MAX(`DATA_TYPE`) = 'varchar'
      AND MAX(`CHARACTER_MAXIMUM_LENGTH`) = 191
      AND MAX(`IS_NULLABLE`) = 'NO'
      AND MAX(`COLUMN_DEFAULT`) IS NULL THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'User'
    AND `COLUMN_NAME` = 'nickname'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'ALTER TABLE `User` MODIFY `nickname` VARCHAR(191) NOT NULL'
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_User_nickname_final'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

-- Backfill only missing moderation statuses from the approved historical flag.
UPDATE `Article`
SET `moderationStatus` = CASE
  WHEN `isFlagged` = TRUE THEN 'EXPLICIT'
  ELSE 'CLEAN'
END
WHERE `moderationStatus` IS NULL;

SET @cp_missing_moderation_status_count = (
  SELECT COUNT(*) FROM `Article` WHERE `moderationStatus` IS NULL
);
SET @cp_sql = IF(
  @cp_missing_moderation_status_count = 0,
  'DO 0',
  'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_missing_moderationStatus'
);
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;

SET @cp_state = (
  SELECT CASE
    WHEN COUNT(*) = 1
      AND MAX(`COLUMN_TYPE`) = 'enum(\'CLEAN\',\'EXPLICIT\',\'BLOCKED\')'
      AND MAX(`IS_NULLABLE`) = 'YES'
      AND MAX(`COLUMN_DEFAULT`) IS NULL THEN 0
    WHEN COUNT(*) = 1
      AND MAX(`COLUMN_TYPE`) = 'enum(\'CLEAN\',\'EXPLICIT\',\'BLOCKED\')'
      AND MAX(`IS_NULLABLE`) = 'NO'
      AND MAX(CAST(`COLUMN_DEFAULT` AS CHAR)) = 'CLEAN' THEN 1
    ELSE 2
  END
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'Article'
    AND `COLUMN_NAME` = 'moderationStatus'
);
SET @cp_sql = CASE @cp_state
  WHEN 0 THEN 'ALTER TABLE `Article` MODIFY `moderationStatus` ENUM(\'CLEAN\', \'EXPLICIT\', \'BLOCKED\') NOT NULL DEFAULT \'CLEAN\''
  WHEN 1 THEN 'DO 0'
  ELSE 'INVALID_SQL__CITYPULSE_SCHEMA_REPAIR_Article_moderationStatus_final'
END;
PREPARE cp_stmt FROM @cp_sql;
EXECUTE cp_stmt;
DEALLOCATE PREPARE cp_stmt;
