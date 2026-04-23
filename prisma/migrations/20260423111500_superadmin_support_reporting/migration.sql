CREATE TABLE `SupportTicket` (
  `id` VARCHAR(64) NOT NULL,
  `tenantId` VARCHAR(64) NOT NULL,
  `branchId` VARCHAR(64) NULL,
  `requesterUserId` VARCHAR(64) NOT NULL,
  `assignedToUserId` VARCHAR(64) NULL,
  `subject` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `channel` VARCHAR(64) NOT NULL,
  `priority` ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
  `status` ENUM('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  `internalNote` TEXT NULL,
  `resolutionNote` TEXT NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_support_ticket_tenant` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_support_ticket_branch` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_support_ticket_requester` FOREIGN KEY (`requesterUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_support_ticket_assignee` FOREIGN KEY (`assignedToUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX `idx_support_ticket_tenant_status`
  ON `SupportTicket`(`tenantId`, `status`, `createdAt`);

CREATE INDEX `idx_support_ticket_assignee_status`
  ON `SupportTicket`(`assignedToUserId`, `status`, `createdAt`);

CREATE INDEX `idx_support_ticket_tenant_priority`
  ON `SupportTicket`(`tenantId`, `priority`, `createdAt`);
