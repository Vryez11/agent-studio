-- CreateTable
CREATE TABLE `agents` (
    `id` CHAR(36) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `currentVersionId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `agents_slug_key`(`slug`),
    UNIQUE INDEX `agents_currentVersionId_key`(`currentVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_versions` (
    `id` CHAR(36) NOT NULL,
    `agentId` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `stages` JSON NOT NULL,
    `contextSchema` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `agent_versions_agentId_version_key`(`agentId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `runs` (
    `id` CHAR(36) NOT NULL,
    `agentId` CHAR(36) NOT NULL,
    `agentVersionId` CHAR(36) NOT NULL,
    `status` ENUM('pending', 'running', 'completed', 'cancelled', 'failed') NOT NULL,
    `initialInput` JSON NOT NULL,
    `currentStageIndex` INTEGER NULL,
    `totalInputTokens` INTEGER NOT NULL DEFAULT 0,
    `totalOutputTokens` INTEGER NOT NULL DEFAULT 0,
    `totalCacheReadTokens` INTEGER NOT NULL DEFAULT 0,
    `totalCostUsd` DECIMAL(10, 6) NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `runs_agentId_idx`(`agentId`),
    INDEX `runs_status_idx`(`status`),
    INDEX `runs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stage_results` (
    `id` CHAR(36) NOT NULL,
    `runId` CHAR(36) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `stageIndex` INTEGER NOT NULL,
    `status` ENUM('pending', 'running', 'completed', 'cancelled', 'failed', 'skipped') NOT NULL,
    `model` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NULL,
    `resolvedPrompt` JSON NULL,
    `outputText` LONGTEXT NULL,
    `outputStructured` JSON NULL,
    `inputTokens` INTEGER NULL,
    `outputTokens` INTEGER NULL,
    `cacheReadTokens` INTEGER NULL,
    `cacheCreationTokens` INTEGER NULL,
    `costUsd` DECIMAL(10, 6) NULL,
    `stopReason` VARCHAR(191) NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,

    INDEX `stage_results_runId_idx`(`runId`),
    UNIQUE INDEX `stage_results_runId_stageIndex_key`(`runId`, `stageIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stage_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `stageResultId` CHAR(36) NOT NULL,
    `seq` INTEGER NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stage_events_stageResultId_seq_key`(`stageResultId`, `seq`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agents` ADD CONSTRAINT `agents_currentVersionId_fkey` FOREIGN KEY (`currentVersionId`) REFERENCES `agent_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_versions` ADD CONSTRAINT `agent_versions_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `agents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `runs` ADD CONSTRAINT `runs_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `agents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `runs` ADD CONSTRAINT `runs_agentVersionId_fkey` FOREIGN KEY (`agentVersionId`) REFERENCES `agent_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_results` ADD CONSTRAINT `stage_results_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_events` ADD CONSTRAINT `stage_events_stageResultId_fkey` FOREIGN KEY (`stageResultId`) REFERENCES `stage_results`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
