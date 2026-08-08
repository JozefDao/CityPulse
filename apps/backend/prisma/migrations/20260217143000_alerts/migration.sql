-- CreateTable
CREATE TABLE `AlertRule` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `cityId` VARCHAR(191) NOT NULL,
  `metric` ENUM('TEMPERATURE', 'WIND_SPEED', 'HUMIDITY', 'PRECIPITATION', 'PM25', 'PM10') NOT NULL,
  `operator` ENUM('GT', 'GTE', 'LT', 'LTE') NOT NULL,
  `threshold` DOUBLE NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `lastConditionMet` BOOLEAN NOT NULL DEFAULT false,
  `lastEvaluationValue` DOUBLE NULL,
  `lastEvaluatedAt` DATETIME(3) NULL,
  `lastTriggeredAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AlertEvent` (
  `id` VARCHAR(191) NOT NULL,
  `ruleId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `cityId` VARCHAR(191) NOT NULL,
  `metric` ENUM('TEMPERATURE', 'WIND_SPEED', 'HUMIDITY', 'PRECIPITATION', 'PM25', 'PM10') NOT NULL,
  `operator` ENUM('GT', 'GTE', 'LT', 'LTE') NOT NULL,
  `threshold` DOUBLE NOT NULL,
  `observedValue` DOUBLE NOT NULL,
  `message` VARCHAR(191) NOT NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AlertRule_userId_createdAt_idx` ON `AlertRule`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `AlertRule_cityId_isActive_idx` ON `AlertRule`(`cityId`, `isActive`);

-- CreateIndex
CREATE INDEX `AlertEvent_userId_isRead_createdAt_idx` ON `AlertEvent`(`userId`, `isRead`, `createdAt`);

-- CreateIndex
CREATE INDEX `AlertEvent_ruleId_createdAt_idx` ON `AlertEvent`(`ruleId`, `createdAt`);

-- CreateIndex
CREATE INDEX `AlertEvent_cityId_createdAt_idx` ON `AlertEvent`(`cityId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `City`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `AlertRule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `City`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
