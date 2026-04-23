ALTER TABLE `AttendanceRecord`
  ADD COLUMN `shiftAssignmentId` VARCHAR(191) NULL;

CREATE TABLE `ShiftTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `startTime` VARCHAR(8) NOT NULL,
  `endTime` VARCHAR(8) NOT NULL,
  `gracePeriodMinutes` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ShiftAssignment` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `shiftTemplateId` VARCHAR(191) NOT NULL,
  `shiftDate` DATE NOT NULL,
  `startAt` DATETIME(3) NOT NULL,
  `endAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `uq_shift_template_tenant_branch_code`
  ON `ShiftTemplate`(`tenantId`, `branchId`, `code`);

CREATE INDEX `idx_shift_template_tenant_branch`
  ON `ShiftTemplate`(`tenantId`, `branchId`);

CREATE UNIQUE INDEX `uq_shift_assignment_employee_date_template`
  ON `ShiftAssignment`(`employeeId`, `shiftDate`, `shiftTemplateId`);

CREATE INDEX `idx_shift_assignment_tenant_branch_date`
  ON `ShiftAssignment`(`tenantId`, `branchId`, `shiftDate`);

CREATE INDEX `idx_shift_assignment_tenant_employee_date`
  ON `ShiftAssignment`(`tenantId`, `employeeId`, `shiftDate`);

ALTER TABLE `AttendanceRecord`
  ADD CONSTRAINT `AttendanceRecord_shiftAssignmentId_fkey`
  FOREIGN KEY (`shiftAssignmentId`) REFERENCES `ShiftAssignment`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ShiftTemplate`
  ADD CONSTRAINT `ShiftTemplate_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ShiftTemplate_branchId_fkey`
  FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ShiftAssignment`
  ADD CONSTRAINT `ShiftAssignment_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ShiftAssignment_branchId_fkey`
  FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ShiftAssignment_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `EmployeeProfile`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ShiftAssignment_shiftTemplateId_fkey`
  FOREIGN KEY (`shiftTemplateId`) REFERENCES `ShiftTemplate`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
