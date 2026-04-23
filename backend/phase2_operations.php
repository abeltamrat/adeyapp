<?php

declare(strict_types=1);

function phase2_decimal_string($value): string
{
    return number_format((float) $value, 2, '.', '');
}

function phase2_leave_day_count(string $startDate, string $endDate): string
{
    $start = new DateTimeImmutable(iso_date_string($startDate), new DateTimeZone('UTC'));
    $end = new DateTimeImmutable(iso_date_string($endDate), new DateTimeZone('UTC'));
    if ($end < $start) {
        error_response('Leave end date must be on or after the start date');
    }

    return phase2_decimal_string(((int) $start->diff($end)->days) + 1);
}

function phase2_leave_type_payload(array $row): array
{
    return [
        'id' => $row['id'],
        'tenantId' => $row['tenantId'],
        'branchId' => $row['branchId'] ?? null,
        'name' => $row['name'],
        'code' => $row['code'],
        'isPaid' => !empty($row['isPaid']),
        'defaultBalanceDays' => phase2_decimal_string($row['defaultBalanceDays']),
        'requiresDocument' => !empty($row['requiresDocument']),
        'createdAt' => $row['createdAt'],
    ];
}

function phase2_leave_balance_payload(array $row): array
{
    return [
        'id' => $row['id'],
        'tenantId' => $row['tenantId'],
        'employeeId' => $row['employeeId'],
        'employeeCode' => $row['employeeCode'] ?? null,
        'employeeEmail' => $row['employeeEmail'] ?? null,
        'leaveTypeId' => $row['leaveTypeId'],
        'leaveTypeName' => $row['leaveTypeName'],
        'leaveTypeCode' => $row['leaveTypeCode'],
        'balanceDays' => phase2_decimal_string($row['balanceDays']),
        'usedDays' => phase2_decimal_string($row['usedDays']),
        'carriedOverDays' => phase2_decimal_string($row['carriedOverDays']),
        'createdAt' => $row['createdAt'],
        'updatedAt' => $row['updatedAt'],
    ];
}

function phase2_leave_branch_impact(
    PDO $pdo,
    string $tenantId,
    string $branchId,
    string $startDate,
    string $endDate,
    ?string $excludeLeaveRequestId = null
): array {
    $activeEmployeesStatement = $pdo->prepare(
        'SELECT COUNT(*) AS total
         FROM EmployeeProfile
         WHERE tenantId = :tenantId
           AND primaryBranchId = :branchId
           AND employmentStatus = :employmentStatus'
    );
    $activeEmployeesStatement->execute([
        'tenantId' => $tenantId,
        'branchId' => $branchId,
        'employmentStatus' => 'active',
    ]);
    $activeEmployees = (int) ((db_one($activeEmployeesStatement)['total'] ?? 0));

    $sql = 'SELECT COUNT(DISTINCT employeeId) AS total
            FROM LeaveRequest
            WHERE tenantId = :tenantId
              AND branchId = :branchId
              AND status IN (\'pending\', \'approved\')
              AND startDate <= :endDate
              AND endDate >= :startDate';
    $params = [
        'tenantId' => $tenantId,
        'branchId' => $branchId,
        'startDate' => iso_date_string($startDate),
        'endDate' => iso_date_string($endDate),
    ];

    if ($excludeLeaveRequestId !== null) {
        $sql .= ' AND id <> :excludeLeaveRequestId';
        $params['excludeLeaveRequestId'] = $excludeLeaveRequestId;
    }

    $employeesOffStatement = $pdo->prepare($sql);
    $employeesOffStatement->execute($params);
    $employeesAlreadyOff = (int) ((db_one($employeesOffStatement)['total'] ?? 0));

    return [
        'activeEmployees' => $activeEmployees,
        'employeesAlreadyOff' => $employeesAlreadyOff,
        'availableEmployeesAfterApproval' => max(0, $activeEmployees - $employeesAlreadyOff - 1),
    ];
}

function phase2_leave_request_payload(PDO $pdo, array $row): array
{
    return [
        'id' => $row['id'],
        'tenantId' => $row['tenantId'],
        'branchId' => $row['branchId'],
        'branchName' => $row['branchName'] ?? null,
        'employeeId' => $row['employeeId'],
        'employeeCode' => $row['employeeCode'] ?? null,
        'employeeEmail' => $row['employeeEmail'] ?? null,
        'leaveTypeId' => $row['leaveTypeId'],
        'leaveTypeName' => $row['leaveTypeName'],
        'leaveTypeCode' => $row['leaveTypeCode'],
        'startDate' => $row['startDate'],
        'endDate' => $row['endDate'],
        'dayCount' => phase2_decimal_string($row['dayCount']),
        'status' => $row['status'],
        'reason' => $row['reason'] ?? null,
        'managerNote' => $row['managerNote'] ?? null,
        'approvedByUserId' => $row['approvedByUserId'] ?? null,
        'approvedAt' => $row['approvedAt'] ?? null,
        'rejectedAt' => $row['rejectedAt'] ?? null,
        'branchImpact' => phase2_leave_branch_impact(
            $pdo,
            $row['tenantId'],
            $row['branchId'],
            $row['startDate'],
            $row['endDate'],
            $row['id']
        ),
        'createdAt' => $row['createdAt'],
    ];
}

function phase2_credit_request_payload(array $row): array
{
    $approvedAmount = $row['approvedAmount'] !== null ? (float) $row['approvedAmount'] : null;
    $repaidAmount = (float) ($row['repaidAmount'] ?? 0);
    $baseline = $approvedAmount !== null ? $approvedAmount : (float) $row['amount'];

    return [
        'id' => $row['id'],
        'tenantId' => $row['tenantId'],
        'branchId' => $row['branchId'],
        'branchName' => $row['branchName'] ?? null,
        'employeeId' => $row['employeeId'],
        'employeeCode' => $row['employeeCode'] ?? null,
        'employeeEmail' => $row['employeeEmail'] ?? null,
        'amount' => phase2_decimal_string($row['amount']),
        'approvedAmount' => $approvedAmount !== null ? phase2_decimal_string($approvedAmount) : null,
        'repaidAmount' => phase2_decimal_string($repaidAmount),
        'outstandingAmount' => phase2_decimal_string(max(0, $baseline - $repaidAmount)),
        'status' => $row['status'],
        'reason' => $row['reason'] ?? null,
        'ownerNote' => $row['ownerNote'] ?? null,
        'requestedAt' => $row['requestedAt'],
        'approvedAt' => $row['approvedAt'] ?? null,
        'settledAt' => $row['settledAt'] ?? null,
        'createdAt' => $row['createdAt'],
    ];
}

function phase2_supplier_payload(array $row): array
{
    return [
        'id' => $row['id'],
        'tenantId' => $row['tenantId'],
        'branchId' => $row['branchId'] ?? null,
        'branchName' => $row['branchName'] ?? null,
        'name' => $row['name'],
        'contactName' => $row['contactName'] ?? null,
        'phone' => $row['phone'] ?? null,
        'email' => $row['email'] ?? null,
        'notes' => $row['notes'] ?? null,
        'status' => $row['status'],
        'createdAt' => $row['createdAt'],
    ];
}

function phase2_purchase_order_item_payload(array $row): array
{
    return [
        'id' => $row['id'],
        'productId' => $row['productId'],
        'productName' => $row['productName'],
        'productSku' => $row['productSku'],
        'quantityOrdered' => phase2_decimal_string($row['quantityOrdered']),
        'quantityReceived' => phase2_decimal_string($row['quantityReceived']),
        'unitCost' => phase2_decimal_string($row['unitCost']),
    ];
}

function phase2_purchase_order_payload(PDO $pdo, array $row): array
{
    $itemStatement = $pdo->prepare(
        'SELECT poi.id, poi.productId, p.name AS productName, p.sku AS productSku,
                poi.quantityOrdered, poi.quantityReceived, poi.unitCost
         FROM PurchaseOrderItem poi
         INNER JOIN Product p ON p.id = poi.productId
         WHERE poi.purchaseOrderId = :purchaseOrderId
         ORDER BY p.name ASC'
    );
    $itemStatement->execute(['purchaseOrderId' => $row['id']]);

    return [
        'id' => $row['id'],
        'tenantId' => $row['tenantId'],
        'branchId' => $row['branchId'],
        'branchName' => $row['branchName'] ?? null,
        'supplierId' => $row['supplierId'],
        'supplierName' => $row['supplierName'],
        'poNumber' => $row['poNumber'],
        'status' => $row['status'],
        'note' => $row['note'] ?? null,
        'orderedAt' => $row['orderedAt'] ?? null,
        'receivedAt' => $row['receivedAt'] ?? null,
        'createdAt' => $row['createdAt'],
        'items' => array_map('phase2_purchase_order_item_payload', $itemStatement->fetchAll()),
    ];
}

function phase2_payroll_batch_payload(PDO $pdo, array $row): array
{
    $itemStatement = $pdo->prepare(
        'SELECT pbi.id, pbi.employeeId, ep.employeeCode, u.email AS employeeEmail,
                pbi.workedMinutes, pbi.lateMinutes, pbi.grossAmount, pbi.deductionsAmount,
                pbi.creditDeductionAmount, pbi.netAmount, pbi.note
         FROM PayrollBatchItem pbi
         INNER JOIN EmployeeProfile ep ON ep.id = pbi.employeeId
         INNER JOIN User u ON u.id = ep.userId
         WHERE pbi.payrollBatchId = :payrollBatchId
         ORDER BY ep.employeeCode ASC'
    );
    $itemStatement->execute(['payrollBatchId' => $row['id']]);
    $items = $itemStatement->fetchAll();

    $grossAmount = 0.0;
    $deductionsAmount = 0.0;
    $creditDeductionAmount = 0.0;
    $netAmount = 0.0;
    $payloadItems = [];
    foreach ($items as $item) {
        $grossAmount += (float) $item['grossAmount'];
        $deductionsAmount += (float) $item['deductionsAmount'];
        $creditDeductionAmount += (float) $item['creditDeductionAmount'];
        $netAmount += (float) $item['netAmount'];
        $payloadItems[] = [
            'id' => $item['id'],
            'employeeId' => $item['employeeId'],
            'employeeCode' => $item['employeeCode'] ?? null,
            'employeeEmail' => $item['employeeEmail'] ?? null,
            'workedMinutes' => (int) $item['workedMinutes'],
            'lateMinutes' => (int) $item['lateMinutes'],
            'grossAmount' => phase2_decimal_string($item['grossAmount']),
            'deductionsAmount' => phase2_decimal_string($item['deductionsAmount']),
            'creditDeductionAmount' => phase2_decimal_string($item['creditDeductionAmount']),
            'netAmount' => phase2_decimal_string($item['netAmount']),
            'note' => $item['note'] ?? null,
        ];
    }

    return [
        'id' => $row['id'],
        'tenantId' => $row['tenantId'],
        'branchId' => $row['branchId'] ?? null,
        'branchName' => $row['branchName'] ?? null,
        'actorUserId' => $row['actorUserId'],
        'fromDate' => $row['fromDate'],
        'toDate' => $row['toDate'],
        'hourlyRate' => phase2_decimal_string($row['hourlyRate']),
        'latePenaltyPerMinute' => phase2_decimal_string($row['latePenaltyPerMinute']),
        'includeCreditDeductions' => !empty($row['includeCreditDeductions']),
        'status' => $row['status'],
        'note' => $row['note'] ?? null,
        'createdAt' => $row['createdAt'],
        'totals' => [
            'grossAmount' => phase2_decimal_string($grossAmount),
            'deductionsAmount' => phase2_decimal_string($deductionsAmount),
            'creditDeductionAmount' => phase2_decimal_string($creditDeductionAmount),
            'netAmount' => phase2_decimal_string($netAmount),
        ],
        'items' => $payloadItems,
    ];
}

function phase2_current_inventory_status(float $quantityOnHand, ?float $reorderLevel): string
{
    if ($quantityOnHand <= 0) {
        return 'out_of_stock';
    }

    if ($reorderLevel !== null && $quantityOnHand <= $reorderLevel) {
        return 'low_stock';
    }

    return 'active';
}

function phase2_ensure_leave_balance(PDO $pdo, string $tenantId, string $employeeId, string $leaveTypeId): array
{
    $statement = $pdo->prepare(
        'SELECT lb.id, lb.tenantId, lb.employeeId, ep.employeeCode, u.email AS employeeEmail,
                lb.leaveTypeId, lt.name AS leaveTypeName, lt.code AS leaveTypeCode,
                lb.balanceDays, lb.usedDays, lb.carriedOverDays, lb.createdAt, lb.updatedAt
         FROM LeaveBalance lb
         INNER JOIN EmployeeProfile ep ON ep.id = lb.employeeId
         INNER JOIN User u ON u.id = ep.userId
         INNER JOIN LeaveType lt ON lt.id = lb.leaveTypeId
         WHERE lb.tenantId = :tenantId
           AND lb.employeeId = :employeeId
           AND lb.leaveTypeId = :leaveTypeId
         LIMIT 1'
    );
    $statement->execute([
        'tenantId' => $tenantId,
        'employeeId' => $employeeId,
        'leaveTypeId' => $leaveTypeId,
    ]);
    $existing = db_one($statement);
    if ($existing) {
        return $existing;
    }

    $typeStatement = $pdo->prepare(
        'SELECT defaultBalanceDays
         FROM LeaveType
         WHERE id = :leaveTypeId
           AND tenantId = :tenantId
         LIMIT 1'
    );
    $typeStatement->execute([
        'leaveTypeId' => $leaveTypeId,
        'tenantId' => $tenantId,
    ]);
    $type = db_one($typeStatement);
    if (!$type) {
        error_response('Leave type not found in the active workspace', 404, 'not_found');
    }

    $insert = $pdo->prepare(
        'INSERT INTO LeaveBalance
         (id, tenantId, employeeId, leaveTypeId, balanceDays, usedDays, carriedOverDays, createdAt, updatedAt)
         VALUES (:id, :tenantId, :employeeId, :leaveTypeId, :balanceDays, :usedDays, :carriedOverDays, :createdAt, :updatedAt)'
    );
    $now = now_string();
    $insert->execute([
        'id' => app_id(),
        'tenantId' => $tenantId,
        'employeeId' => $employeeId,
        'leaveTypeId' => $leaveTypeId,
        'balanceDays' => $type['defaultBalanceDays'],
        'usedDays' => 0,
        'carriedOverDays' => 0,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    $statement->execute([
        'tenantId' => $tenantId,
        'employeeId' => $employeeId,
        'leaveTypeId' => $leaveTypeId,
    ]);
    return (array) db_one($statement);
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/leave/types') {
    $authUser = require_management_workspace(authenticated_user());
    $branchId = trim((string) (query_value('branchId') ?? ''));

    $sql = 'SELECT *
            FROM LeaveType
            WHERE tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        $sql .= ' AND (branchId IS NULL OR branchId = :branchId)';
        $params['branchId'] = $branchId;
    }

    $sql .= ' ORDER BY name ASC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map('phase2_leave_type_payload', $statement->fetchAll()));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/leave/types') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();
    $branchId = trim((string) ($payload['branchId'] ?? ''));
    $name = trim((string) ($payload['name'] ?? ''));
    $code = strtoupper(trim((string) ($payload['code'] ?? '')));
    $isPaid = !array_key_exists('isPaid', $payload) || !empty($payload['isPaid']);
    $defaultBalanceDays = isset($payload['defaultBalanceDays']) ? max(0, (float) $payload['defaultBalanceDays']) : 0.0;
    $requiresDocument = !empty($payload['requiresDocument']);

    if ($name === '' || $code === '') {
        error_response('Leave type name and code are required');
    }

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
    } else {
        $branchId = null;
    }

    $existsStatement = $pdo->prepare(
        'SELECT id FROM LeaveType WHERE tenantId = :tenantId AND code = :code LIMIT 1'
    );
    $existsStatement->execute([
        'tenantId' => $authUser['tenantId'],
        'code' => $code,
    ]);
    if (db_one($existsStatement)) {
        error_response('Leave type code already exists in this workspace', 409, 'conflict');
    }

    $leaveTypeId = app_id();
    $now = now_string();
    $insert = $pdo->prepare(
        'INSERT INTO LeaveType
         (id, tenantId, branchId, name, code, isPaid, defaultBalanceDays, requiresDocument, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :name, :code, :isPaid, :defaultBalanceDays, :requiresDocument, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $leaveTypeId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'name' => $name,
        'code' => $code,
        'isPaid' => $isPaid ? 1 : 0,
        'defaultBalanceDays' => phase2_decimal_string($defaultBalanceDays),
        'requiresDocument' => $requiresDocument ? 1 : 0,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    $statement = $pdo->prepare('SELECT * FROM LeaveType WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $leaveTypeId]);
    json_response(phase2_leave_type_payload((array) db_one($statement)), 201);
}

if ($method === 'GET' && $path === '/api/v1/employee/leave/types') {
    $authUser = require_employee_workspace(authenticated_user());
    $statement = $pdo->prepare(
        'SELECT *
         FROM LeaveType
         WHERE tenantId = :tenantId
           AND (branchId IS NULL OR branchId = :branchId)
         ORDER BY name ASC'
    );
    $statement->execute([
        'tenantId' => $authUser['tenantId'],
        'branchId' => $authUser['branchId'],
    ]);

    json_response(array_map('phase2_leave_type_payload', $statement->fetchAll()));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/leave/balances') {
    $authUser = require_management_workspace(authenticated_user());
    $branchId = trim((string) (query_value('branchId') ?? ''));
    $employeeId = trim((string) (query_value('employeeId') ?? ''));

    $sql = 'SELECT lb.id, lb.tenantId, lb.employeeId, ep.employeeCode, u.email AS employeeEmail,
                   lb.leaveTypeId, lt.name AS leaveTypeName, lt.code AS leaveTypeCode,
                   lb.balanceDays, lb.usedDays, lb.carriedOverDays, lb.createdAt, lb.updatedAt
            FROM LeaveBalance lb
            INNER JOIN EmployeeProfile ep ON ep.id = lb.employeeId
            INNER JOIN User u ON u.id = ep.userId
            INNER JOIN LeaveType lt ON lt.id = lb.leaveTypeId
            WHERE lb.tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        $sql .= ' AND ep.primaryBranchId = :branchId';
        $params['branchId'] = $branchId;
    }

    if ($employeeId !== '') {
        $sql .= ' AND lb.employeeId = :employeeId';
        $params['employeeId'] = $employeeId;
    }

    $sql .= ' ORDER BY lt.name ASC, ep.employeeCode ASC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map('phase2_leave_balance_payload', $statement->fetchAll()));
}

if ($method === 'GET' && $path === '/api/v1/employee/leave/balances') {
    $authUser = require_employee_workspace(authenticated_user());
    $statement = $pdo->prepare(
        'SELECT lb.id, lb.tenantId, lb.employeeId, ep.employeeCode, u.email AS employeeEmail,
                lb.leaveTypeId, lt.name AS leaveTypeName, lt.code AS leaveTypeCode,
                lb.balanceDays, lb.usedDays, lb.carriedOverDays, lb.createdAt, lb.updatedAt
         FROM LeaveBalance lb
         INNER JOIN EmployeeProfile ep ON ep.id = lb.employeeId
         INNER JOIN User u ON u.id = ep.userId
         INNER JOIN LeaveType lt ON lt.id = lb.leaveTypeId
         WHERE lb.tenantId = :tenantId
           AND lb.employeeId = :employeeId
         ORDER BY lt.name ASC'
    );
    $statement->execute([
        'tenantId' => $authUser['tenantId'],
        'employeeId' => $authUser['employeeId'],
    ]);

    json_response(array_map('phase2_leave_balance_payload', $statement->fetchAll()));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/leave/balances') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();
    $employeeId = trim((string) ($payload['employeeId'] ?? ''));
    $leaveTypeId = trim((string) ($payload['leaveTypeId'] ?? ''));
    $balanceDays = isset($payload['balanceDays']) ? max(0, (float) $payload['balanceDays']) : 0.0;
    $usedDays = isset($payload['usedDays']) ? max(0, (float) $payload['usedDays']) : 0.0;
    $carriedOverDays = isset($payload['carriedOverDays']) ? max(0, (float) $payload['carriedOverDays']) : 0.0;

    if ($employeeId === '' || $leaveTypeId === '') {
        error_response('Employee and leave type are required to adjust a leave balance');
    }

    $balance = phase2_ensure_leave_balance($pdo, $authUser['tenantId'], $employeeId, $leaveTypeId);
    $update = $pdo->prepare(
        'UPDATE LeaveBalance
         SET balanceDays = :balanceDays, usedDays = :usedDays, carriedOverDays = :carriedOverDays, updatedAt = :updatedAt
         WHERE id = :id'
    );
    $update->execute([
        'balanceDays' => phase2_decimal_string($balanceDays),
        'usedDays' => phase2_decimal_string($usedDays),
        'carriedOverDays' => phase2_decimal_string($carriedOverDays),
        'updatedAt' => now_string(),
        'id' => $balance['id'],
    ]);

    $statement = $pdo->prepare(
        'SELECT lb.id, lb.tenantId, lb.employeeId, ep.employeeCode, u.email AS employeeEmail,
                lb.leaveTypeId, lt.name AS leaveTypeName, lt.code AS leaveTypeCode,
                lb.balanceDays, lb.usedDays, lb.carriedOverDays, lb.createdAt, lb.updatedAt
         FROM LeaveBalance lb
         INNER JOIN EmployeeProfile ep ON ep.id = lb.employeeId
         INNER JOIN User u ON u.id = ep.userId
         INNER JOIN LeaveType lt ON lt.id = lb.leaveTypeId
         WHERE lb.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $balance['id']]);
    json_response(phase2_leave_balance_payload((array) db_one($statement)));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/leave/requests') {
    $authUser = require_management_workspace(authenticated_user());
    $branchId = trim((string) (query_value('branchId') ?? ''));
    $status = trim((string) (query_value('status') ?? ''));
    $sql = 'SELECT lr.*, b.name AS branchName, ep.employeeCode, u.email AS employeeEmail,
                   lt.name AS leaveTypeName, lt.code AS leaveTypeCode
            FROM LeaveRequest lr
            INNER JOIN Branch b ON b.id = lr.branchId
            INNER JOIN EmployeeProfile ep ON ep.id = lr.employeeId
            INNER JOIN User u ON u.id = ep.userId
            INNER JOIN LeaveType lt ON lt.id = lr.leaveTypeId
            WHERE lr.tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        $sql .= ' AND lr.branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    if ($status !== '') {
        $sql .= ' AND lr.status = :status';
        $params['status'] = $status;
    }

    $sql .= ' ORDER BY lr.createdAt DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();
    json_response(array_map(static fn (array $row): array => phase2_leave_request_payload($pdo, $row), $rows));
}

if ($method === 'GET' && $path === '/api/v1/employee/leave/requests') {
    $authUser = require_employee_workspace(authenticated_user());
    $statement = $pdo->prepare(
        'SELECT lr.*, b.name AS branchName, ep.employeeCode, u.email AS employeeEmail,
                lt.name AS leaveTypeName, lt.code AS leaveTypeCode
         FROM LeaveRequest lr
         INNER JOIN Branch b ON b.id = lr.branchId
         INNER JOIN EmployeeProfile ep ON ep.id = lr.employeeId
         INNER JOIN User u ON u.id = ep.userId
         INNER JOIN LeaveType lt ON lt.id = lr.leaveTypeId
         WHERE lr.tenantId = :tenantId
           AND lr.employeeId = :employeeId
         ORDER BY lr.createdAt DESC'
    );
    $statement->execute([
        'tenantId' => $authUser['tenantId'],
        'employeeId' => $authUser['employeeId'],
    ]);
    $rows = $statement->fetchAll();
    json_response(array_map(static fn (array $row): array => phase2_leave_request_payload($pdo, $row), $rows));
}

if ($method === 'POST' && $path === '/api/v1/employee/leave/requests') {
    $authUser = require_employee_workspace(authenticated_user());
    $payload = json_input();
    $leaveTypeId = trim((string) ($payload['leaveTypeId'] ?? ''));
    $startDate = iso_date_string((string) ($payload['startDate'] ?? ''));
    $endDate = iso_date_string((string) ($payload['endDate'] ?? ''));
    $reason = trim((string) ($payload['reason'] ?? ''));

    if ($leaveTypeId === '') {
        error_response('Leave type is required');
    }

    $leaveTypeStatement = $pdo->prepare(
        'SELECT *
         FROM LeaveType
         WHERE id = :id
           AND tenantId = :tenantId
           AND (branchId IS NULL OR branchId = :branchId)
         LIMIT 1'
    );
    $leaveTypeStatement->execute([
        'id' => $leaveTypeId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $authUser['branchId'],
    ]);
    $leaveType = db_one($leaveTypeStatement);
    if (!$leaveType) {
        error_response('Leave type not found for the active branch', 404, 'not_found');
    }

    $dayCount = phase2_leave_day_count($startDate, $endDate);
    $balance = phase2_ensure_leave_balance($pdo, $authUser['tenantId'], $authUser['employeeId'], $leaveTypeId);
    if ((float) $balance['balanceDays'] < (float) $dayCount) {
        error_response('Requested leave exceeds the available leave balance', 409, 'conflict');
    }

    $overlapStatement = $pdo->prepare(
        'SELECT id
         FROM LeaveRequest
         WHERE tenantId = :tenantId
           AND employeeId = :employeeId
           AND status IN (\'pending\', \'approved\')
           AND startDate <= :endDate
           AND endDate >= :startDate
         LIMIT 1'
    );
    $overlapStatement->execute([
        'tenantId' => $authUser['tenantId'],
        'employeeId' => $authUser['employeeId'],
        'startDate' => $startDate,
        'endDate' => $endDate,
    ]);
    if (db_one($overlapStatement)) {
        error_response('This leave period overlaps an existing pending or approved request', 409, 'conflict');
    }

    $leaveRequestId = app_id();
    $now = now_string();
    $insert = $pdo->prepare(
        'INSERT INTO LeaveRequest
         (id, tenantId, branchId, employeeId, leaveTypeId, startDate, endDate, dayCount, status, reason, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :employeeId, :leaveTypeId, :startDate, :endDate, :dayCount, :status, :reason, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $leaveRequestId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $authUser['branchId'],
        'employeeId' => $authUser['employeeId'],
        'leaveTypeId' => $leaveTypeId,
        'startDate' => $startDate,
        'endDate' => $endDate,
        'dayCount' => $dayCount,
        'status' => 'pending',
        'reason' => $reason !== '' ? $reason : null,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    notify_workspace_roles(
        $pdo,
        $authUser['tenantId'],
        $authUser['branchId'],
        ['owner', 'manager'],
        'leave_request_submitted',
        'New leave request submitted',
        'A staff member submitted a leave request that needs review.',
        'LeaveRequest',
        $leaveRequestId
    );

    $statement = $pdo->prepare(
        'SELECT lr.*, b.name AS branchName, ep.employeeCode, u.email AS employeeEmail,
                lt.name AS leaveTypeName, lt.code AS leaveTypeCode
         FROM LeaveRequest lr
         INNER JOIN Branch b ON b.id = lr.branchId
         INNER JOIN EmployeeProfile ep ON ep.id = lr.employeeId
         INNER JOIN User u ON u.id = ep.userId
         INNER JOIN LeaveType lt ON lt.id = lr.leaveTypeId
         WHERE lr.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $leaveRequestId]);
    json_response(phase2_leave_request_payload($pdo, (array) db_one($statement)), 201);
}

if ($method === 'POST' && preg_match('#^/api/v1/tenant-management/leave/requests/([^/]+)/status$#', $path, $matches) === 1) {
    $authUser = require_management_workspace(authenticated_user());
    $leaveRequestId = trim((string) $matches[1]);
    $payload = json_input();
    $status = trim((string) ($payload['status'] ?? ''));
    $managerNote = trim((string) ($payload['managerNote'] ?? ''));
    if (!in_array($status, ['approved', 'rejected', 'canceled'], true)) {
        error_response('Unsupported leave request status');
    }

    $statement = $pdo->prepare(
        'SELECT lr.*, b.name AS branchName, ep.employeeCode, ep.userId AS employeeUserId, u.email AS employeeEmail,
                lt.name AS leaveTypeName, lt.code AS leaveTypeCode
         FROM LeaveRequest lr
         INNER JOIN Branch b ON b.id = lr.branchId
         INNER JOIN EmployeeProfile ep ON ep.id = lr.employeeId
         INNER JOIN User u ON u.id = ep.userId
         INNER JOIN LeaveType lt ON lt.id = lr.leaveTypeId
         WHERE lr.id = :id
           AND lr.tenantId = :tenantId
         LIMIT 1'
    );
    $statement->execute([
        'id' => $leaveRequestId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $leaveRequest = db_one($statement);
    if (!$leaveRequest) {
        error_response('Leave request not found in the active workspace', 404, 'not_found');
    }

    $now = now_string();
    $pdo->beginTransaction();
    try {
        if ($status === 'approved') {
            $balance = phase2_ensure_leave_balance($pdo, $authUser['tenantId'], $leaveRequest['employeeId'], $leaveRequest['leaveTypeId']);
            $nextBalance = max(0, (float) $balance['balanceDays'] - (float) $leaveRequest['dayCount']);
            $nextUsed = (float) $balance['usedDays'] + (float) $leaveRequest['dayCount'];
            $balanceUpdate = $pdo->prepare(
                'UPDATE LeaveBalance
                 SET balanceDays = :balanceDays, usedDays = :usedDays, updatedAt = :updatedAt
                 WHERE id = :id'
            );
            $balanceUpdate->execute([
                'balanceDays' => phase2_decimal_string($nextBalance),
                'usedDays' => phase2_decimal_string($nextUsed),
                'updatedAt' => $now,
                'id' => $balance['id'],
            ]);
        }

        $update = $pdo->prepare(
            'UPDATE LeaveRequest
             SET status = :status,
                 managerNote = :managerNote,
                 approvedByUserId = :approvedByUserId,
                 approvedAt = :approvedAt,
                 rejectedAt = :rejectedAt,
                 updatedAt = :updatedAt
             WHERE id = :id'
        );
        $update->execute([
            'status' => $status,
            'managerNote' => $managerNote !== '' ? $managerNote : null,
            'approvedByUserId' => $status === 'approved' ? $authUser['userId'] : null,
            'approvedAt' => $status === 'approved' ? $now : null,
            'rejectedAt' => $status === 'rejected' ? $now : null,
            'updatedAt' => $now,
            'id' => $leaveRequestId,
        ]);

        if (!empty($leaveRequest['employeeUserId'])) {
            create_notification(
                $pdo,
                $authUser['tenantId'],
                $leaveRequest['branchId'],
                $leaveRequest['employeeUserId'],
                'leave_request_updated',
                'Leave request updated',
                sprintf('Your leave request is now marked as %s.', $status),
                'LeaveRequest',
                $leaveRequestId
            );
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    $statement->execute([
        'id' => $leaveRequestId,
        'tenantId' => $authUser['tenantId'],
    ]);
    json_response(phase2_leave_request_payload($pdo, (array) db_one($statement)));
}

if ($method === 'GET' && $path === '/api/v1/employee/credit-requests') {
    $authUser = require_employee_workspace(authenticated_user());
    require_enabled_module($pdo, $authUser['tenantId'], 'employeeCredit', 'Employee credit is disabled for this workspace');

    $statement = $pdo->prepare(
        'SELECT cr.*, b.name AS branchName, ep.employeeCode, u.email AS employeeEmail
         FROM CreditRequest cr
         INNER JOIN Branch b ON b.id = cr.branchId
         INNER JOIN EmployeeProfile ep ON ep.id = cr.employeeId
         INNER JOIN User u ON u.id = ep.userId
         WHERE cr.tenantId = :tenantId
           AND cr.employeeId = :employeeId
         ORDER BY cr.createdAt DESC'
    );
    $statement->execute([
        'tenantId' => $authUser['tenantId'],
        'employeeId' => $authUser['employeeId'],
    ]);

    json_response(array_map('phase2_credit_request_payload', $statement->fetchAll()));
}

if ($method === 'POST' && $path === '/api/v1/employee/credit-requests') {
    $authUser = require_employee_workspace(authenticated_user());
    require_enabled_module($pdo, $authUser['tenantId'], 'employeeCredit', 'Employee credit is disabled for this workspace');

    $employeeStatement = $pdo->prepare(
        'SELECT creditEligible
         FROM EmployeeProfile
         WHERE id = :id
           AND tenantId = :tenantId
         LIMIT 1'
    );
    $employeeStatement->execute([
        'id' => $authUser['employeeId'],
        'tenantId' => $authUser['tenantId'],
    ]);
    $employee = db_one($employeeStatement);
    if (!$employee || empty($employee['creditEligible'])) {
        error_response('This employee is not eligible for credit requests', 403, 'forbidden');
    }

    $payload = json_input();
    $amount = isset($payload['amount']) ? max(0, (float) $payload['amount']) : 0.0;
    $reason = trim((string) ($payload['reason'] ?? ''));
    if ($amount <= 0) {
        error_response('Credit request amount must be greater than zero');
    }

    $creditRequestId = app_id();
    $now = now_string();
    $insert = $pdo->prepare(
        'INSERT INTO CreditRequest
         (id, tenantId, branchId, employeeId, amount, approvedAmount, repaidAmount, status, reason, requestedAt, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :employeeId, :amount, :approvedAmount, :repaidAmount, :status, :reason, :requestedAt, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $creditRequestId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $authUser['branchId'],
        'employeeId' => $authUser['employeeId'],
        'amount' => phase2_decimal_string($amount),
        'approvedAmount' => null,
        'repaidAmount' => 0,
        'status' => 'pending',
        'reason' => $reason !== '' ? $reason : null,
        'requestedAt' => $now,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    notify_workspace_roles(
        $pdo,
        $authUser['tenantId'],
        $authUser['branchId'],
        ['owner', 'manager'],
        'credit_request_submitted',
        'New employee credit request',
        'A staff member submitted a new credit request for review.',
        'CreditRequest',
        $creditRequestId
    );

    $statement = $pdo->prepare(
        'SELECT cr.*, b.name AS branchName, ep.employeeCode, u.email AS employeeEmail
         FROM CreditRequest cr
         INNER JOIN Branch b ON b.id = cr.branchId
         INNER JOIN EmployeeProfile ep ON ep.id = cr.employeeId
         INNER JOIN User u ON u.id = ep.userId
         WHERE cr.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $creditRequestId]);
    json_response(phase2_credit_request_payload((array) db_one($statement)), 201);
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/credit-requests') {
    $authUser = require_management_workspace(authenticated_user());
    require_enabled_module($pdo, $authUser['tenantId'], 'employeeCredit', 'Employee credit is disabled for this workspace');
    $branchId = trim((string) (query_value('branchId') ?? ''));
    $status = trim((string) (query_value('status') ?? ''));

    $sql = 'SELECT cr.*, b.name AS branchName, ep.employeeCode, u.email AS employeeEmail
            FROM CreditRequest cr
            INNER JOIN Branch b ON b.id = cr.branchId
            INNER JOIN EmployeeProfile ep ON ep.id = cr.employeeId
            INNER JOIN User u ON u.id = ep.userId
            WHERE cr.tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        $sql .= ' AND cr.branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    if ($status !== '') {
        $sql .= ' AND cr.status = :status';
        $params['status'] = $status;
    }

    $sql .= ' ORDER BY cr.createdAt DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    json_response(array_map('phase2_credit_request_payload', $statement->fetchAll()));
}

if ($method === 'POST' && preg_match('#^/api/v1/tenant-management/credit-requests/([^/]+)/status$#', $path, $matches) === 1) {
    $authUser = require_management_workspace(authenticated_user());
    require_enabled_module($pdo, $authUser['tenantId'], 'employeeCredit', 'Employee credit is disabled for this workspace');
    $creditRequestId = trim((string) $matches[1]);
    $payload = json_input();
    $status = trim((string) ($payload['status'] ?? ''));
    $ownerNote = trim((string) ($payload['ownerNote'] ?? ''));
    $approvedAmount = array_key_exists('approvedAmount', $payload) ? max(0, (float) $payload['approvedAmount']) : null;
    if (!in_array($status, ['approved', 'rejected'], true)) {
        error_response('Unsupported credit request status');
    }

    $statement = $pdo->prepare(
        'SELECT cr.*, b.name AS branchName, ep.employeeCode, ep.userId AS employeeUserId, u.email AS employeeEmail
         FROM CreditRequest cr
         INNER JOIN Branch b ON b.id = cr.branchId
         INNER JOIN EmployeeProfile ep ON ep.id = cr.employeeId
         INNER JOIN User u ON u.id = ep.userId
         WHERE cr.id = :id
           AND cr.tenantId = :tenantId
         LIMIT 1'
    );
    $statement->execute([
        'id' => $creditRequestId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $creditRequest = db_one($statement);
    if (!$creditRequest) {
        error_response('Credit request not found in the active workspace', 404, 'not_found');
    }

    $now = now_string();
    $update = $pdo->prepare(
        'UPDATE CreditRequest
         SET status = :status,
             approvedAmount = :approvedAmount,
             ownerNote = :ownerNote,
             approvedAt = :approvedAt,
             updatedAt = :updatedAt
         WHERE id = :id'
    );
    $update->execute([
        'status' => $status,
        'approvedAmount' => $status === 'approved'
            ? phase2_decimal_string($approvedAmount !== null && $approvedAmount > 0 ? $approvedAmount : $creditRequest['amount'])
            : null,
        'ownerNote' => $ownerNote !== '' ? $ownerNote : null,
        'approvedAt' => $status === 'approved' ? $now : null,
        'updatedAt' => $now,
        'id' => $creditRequestId,
    ]);

    if (!empty($creditRequest['employeeUserId'])) {
        create_notification(
            $pdo,
            $authUser['tenantId'],
            $creditRequest['branchId'],
            $creditRequest['employeeUserId'],
            'credit_request_updated',
            'Credit request updated',
            sprintf('Your credit request is now marked as %s.', $status),
            'CreditRequest',
            $creditRequestId
        );
    }

    $statement->execute([
        'id' => $creditRequestId,
        'tenantId' => $authUser['tenantId'],
    ]);
    json_response(phase2_credit_request_payload((array) db_one($statement)));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/payroll/batches') {
    $authUser = require_owner_workspace(authenticated_user());
    $branchId = trim((string) (query_value('branchId') ?? ''));
    $fromDate = trim((string) (query_value('fromDate') ?? ''));
    $toDate = trim((string) (query_value('toDate') ?? ''));

    $sql = 'SELECT pb.*, b.name AS branchName
            FROM PayrollBatch pb
            LEFT JOIN Branch b ON b.id = pb.branchId
            WHERE pb.tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        $sql .= ' AND pb.branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    if ($fromDate !== '') {
        $sql .= ' AND pb.fromDate >= :fromDate';
        $params['fromDate'] = iso_date_string($fromDate);
    }

    if ($toDate !== '') {
        $sql .= ' AND pb.toDate <= :toDate';
        $params['toDate'] = iso_date_string($toDate);
    }

    $sql .= ' ORDER BY pb.createdAt DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();
    json_response(array_map(static fn (array $row): array => phase2_payroll_batch_payload($pdo, $row), $rows));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/payroll/batches') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();
    $branchId = trim((string) ($payload['branchId'] ?? ($authUser['branchId'] ?? '')));
    $fromDate = iso_date_string((string) ($payload['fromDate'] ?? ''));
    $toDate = iso_date_string((string) ($payload['toDate'] ?? ''));
    $hourlyRate = isset($payload['hourlyRate']) ? max(0, (float) $payload['hourlyRate']) : 0.0;
    $latePenaltyPerMinute = isset($payload['latePenaltyPerMinute']) ? max(0, (float) $payload['latePenaltyPerMinute']) : 0.0;
    $includeCreditDeductions = !array_key_exists('includeCreditDeductions', $payload) || !empty($payload['includeCreditDeductions']);
    $note = trim((string) ($payload['note'] ?? ''));

    $rangeStart = new DateTimeImmutable($fromDate . ' 00:00:00', new DateTimeZone('UTC'));
    $rangeEnd = (new DateTimeImmutable($toDate . ' 00:00:00', new DateTimeZone('UTC')))->modify('+1 day');
    if ($rangeEnd <= $rangeStart) {
        error_response('The payroll batch end date must be after the start date');
    }

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
    } else {
        $branchId = null;
    }

    $summary = attendance_payroll_summary_collection(
        attendance_payroll_rows(
            $pdo,
            $authUser['tenantId'],
            $branchId,
            format_datetime($rangeStart),
            format_datetime($rangeEnd)
        )
    );

    $batchId = app_id();
    $now = now_string();
    $pdo->beginTransaction();
    try {
        $batchInsert = $pdo->prepare(
            'INSERT INTO PayrollBatch
             (id, tenantId, branchId, actorUserId, fromDate, toDate, hourlyRate, latePenaltyPerMinute, includeCreditDeductions, status, note, createdAt, updatedAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :fromDate, :toDate, :hourlyRate, :latePenaltyPerMinute, :includeCreditDeductions, :status, :note, :createdAt, :updatedAt)'
        );
        $batchInsert->execute([
            'id' => $batchId,
            'tenantId' => $authUser['tenantId'],
            'branchId' => $branchId,
            'actorUserId' => $authUser['userId'],
            'fromDate' => $fromDate,
            'toDate' => $toDate,
            'hourlyRate' => phase2_decimal_string($hourlyRate),
            'latePenaltyPerMinute' => phase2_decimal_string($latePenaltyPerMinute),
            'includeCreditDeductions' => $includeCreditDeductions ? 1 : 0,
            'status' => 'finalized',
            'note' => $note !== '' ? $note : null,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        foreach ($summary as $item) {
            $workedHours = ((float) $item['totalWorkedMinutes']) / 60;
            $grossAmount = $workedHours * $hourlyRate;
            $deductionsAmount = ((float) $item['totalLatenessMinutes']) * $latePenaltyPerMinute;
            $creditDeductionAmount = 0.0;

            if ($includeCreditDeductions) {
                $creditStatement = $pdo->prepare(
                    'SELECT *
                     FROM CreditRequest
                     WHERE tenantId = :tenantId
                       AND employeeId = :employeeId
                       AND status = :status
                     ORDER BY requestedAt ASC'
                );
                $creditStatement->execute([
                    'tenantId' => $authUser['tenantId'],
                    'employeeId' => $item['employeeId'],
                    'status' => 'approved',
                ]);
                foreach ($creditStatement->fetchAll() as $creditRow) {
                    $approvedAmount = $creditRow['approvedAmount'] !== null ? (float) $creditRow['approvedAmount'] : (float) $creditRow['amount'];
                    $repaidAmount = (float) ($creditRow['repaidAmount'] ?? 0);
                    $outstanding = max(0, $approvedAmount - $repaidAmount);
                    if ($outstanding <= 0) {
                        continue;
                    }

                    $creditDeductionAmount += $outstanding;
                    $creditUpdate = $pdo->prepare(
                        'UPDATE CreditRequest
                         SET repaidAmount = :repaidAmount, status = :status, settledAt = :settledAt, updatedAt = :updatedAt
                         WHERE id = :id'
                    );
                    $creditUpdate->execute([
                        'repaidAmount' => phase2_decimal_string($approvedAmount),
                        'status' => 'settled',
                        'settledAt' => $now,
                        'updatedAt' => $now,
                        'id' => $creditRow['id'],
                    ]);
                }
            }

            $netAmount = max(0, $grossAmount - $deductionsAmount - $creditDeductionAmount);
            $itemInsert = $pdo->prepare(
                'INSERT INTO PayrollBatchItem
                 (id, tenantId, payrollBatchId, employeeId, workedMinutes, lateMinutes, grossAmount, deductionsAmount, creditDeductionAmount, netAmount, note, createdAt, updatedAt)
                 VALUES (:id, :tenantId, :payrollBatchId, :employeeId, :workedMinutes, :lateMinutes, :grossAmount, :deductionsAmount, :creditDeductionAmount, :netAmount, :note, :createdAt, :updatedAt)'
            );
            $itemInsert->execute([
                'id' => app_id(),
                'tenantId' => $authUser['tenantId'],
                'payrollBatchId' => $batchId,
                'employeeId' => $item['employeeId'],
                'workedMinutes' => (int) $item['totalWorkedMinutes'],
                'lateMinutes' => (int) $item['totalLatenessMinutes'],
                'grossAmount' => phase2_decimal_string($grossAmount),
                'deductionsAmount' => phase2_decimal_string($deductionsAmount),
                'creditDeductionAmount' => phase2_decimal_string($creditDeductionAmount),
                'netAmount' => phase2_decimal_string($netAmount),
                'note' => null,
                'createdAt' => $now,
                'updatedAt' => $now,
            ]);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    $statement = $pdo->prepare(
        'SELECT pb.*, b.name AS branchName
         FROM PayrollBatch pb
         LEFT JOIN Branch b ON b.id = pb.branchId
         WHERE pb.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $batchId]);
    json_response(phase2_payroll_batch_payload($pdo, (array) db_one($statement)), 201);
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/suppliers') {
    $authUser = require_management_workspace(authenticated_user());
    $branchId = trim((string) (query_value('branchId') ?? ''));
    $sql = 'SELECT s.*, b.name AS branchName
            FROM Supplier s
            LEFT JOIN Branch b ON b.id = s.branchId
            WHERE s.tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        $sql .= ' AND (s.branchId IS NULL OR s.branchId = :branchId)';
        $params['branchId'] = $branchId;
    }

    $sql .= ' ORDER BY s.name ASC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    json_response(array_map('phase2_supplier_payload', $statement->fetchAll()));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/suppliers') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();
    $branchId = trim((string) ($payload['branchId'] ?? ''));
    $name = trim((string) ($payload['name'] ?? ''));
    $contactName = trim((string) ($payload['contactName'] ?? ''));
    $phone = trim((string) ($payload['phone'] ?? ''));
    $email = trim((string) ($payload['email'] ?? ''));
    $notes = trim((string) ($payload['notes'] ?? ''));
    if ($name === '') {
        error_response('Supplier name is required');
    }

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
    } else {
        $branchId = null;
    }

    $supplierId = app_id();
    $now = now_string();
    $insert = $pdo->prepare(
        'INSERT INTO Supplier
         (id, tenantId, branchId, name, contactName, phone, email, notes, status, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :name, :contactName, :phone, :email, :notes, :status, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $supplierId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'name' => $name,
        'contactName' => $contactName !== '' ? $contactName : null,
        'phone' => $phone !== '' ? $phone : null,
        'email' => $email !== '' ? $email : null,
        'notes' => $notes !== '' ? $notes : null,
        'status' => 'active',
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    $statement = $pdo->prepare(
        'SELECT s.*, b.name AS branchName
         FROM Supplier s
         LEFT JOIN Branch b ON b.id = s.branchId
         WHERE s.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $supplierId]);
    json_response(phase2_supplier_payload((array) db_one($statement)), 201);
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/purchase-orders') {
    $authUser = require_management_workspace(authenticated_user());
    $branchId = trim((string) (query_value('branchId') ?? ''));
    $status = trim((string) (query_value('status') ?? ''));
    $sql = 'SELECT po.*, b.name AS branchName, s.name AS supplierName
            FROM PurchaseOrder po
            INNER JOIN Branch b ON b.id = po.branchId
            INNER JOIN Supplier s ON s.id = po.supplierId
            WHERE po.tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        $sql .= ' AND po.branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    if ($status !== '') {
        $sql .= ' AND po.status = :status';
        $params['status'] = $status;
    }

    $sql .= ' ORDER BY po.createdAt DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();
    json_response(array_map(static fn (array $row): array => phase2_purchase_order_payload($pdo, $row), $rows));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/purchase-orders') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();
    $branchId = trim((string) ($payload['branchId'] ?? ''));
    $supplierId = trim((string) ($payload['supplierId'] ?? ''));
    $note = trim((string) ($payload['note'] ?? ''));
    $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
    if ($branchId === '' || $supplierId === '' || !$items) {
        error_response('Branch, supplier, and at least one purchase order item are required');
    }

    assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
    $supplierStatement = $pdo->prepare(
        'SELECT id, name
         FROM Supplier
         WHERE id = :id
           AND tenantId = :tenantId
         LIMIT 1'
    );
    $supplierStatement->execute([
        'id' => $supplierId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $supplier = db_one($supplierStatement);
    if (!$supplier) {
        error_response('Supplier not found in the active workspace', 404, 'not_found');
    }

    $purchaseOrderId = app_id();
    $poNumber = 'PO-' . (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('YmdHis');
    $now = now_string();

    $pdo->beginTransaction();
    try {
        $insert = $pdo->prepare(
            'INSERT INTO PurchaseOrder
             (id, tenantId, branchId, supplierId, poNumber, status, note, orderedAt, createdAt, updatedAt)
             VALUES (:id, :tenantId, :branchId, :supplierId, :poNumber, :status, :note, :orderedAt, :createdAt, :updatedAt)'
        );
        $insert->execute([
            'id' => $purchaseOrderId,
            'tenantId' => $authUser['tenantId'],
            'branchId' => $branchId,
            'supplierId' => $supplierId,
            'poNumber' => $poNumber,
            'status' => 'ordered',
            'note' => $note !== '' ? $note : null,
            'orderedAt' => $now,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $productStatement = $pdo->prepare(
            'SELECT id, name, sku
             FROM Product
             WHERE id = :id
               AND tenantId = :tenantId
               AND branchId = :branchId
             LIMIT 1'
        );
        $itemInsert = $pdo->prepare(
            'INSERT INTO PurchaseOrderItem
             (id, tenantId, purchaseOrderId, productId, quantityOrdered, quantityReceived, unitCost, createdAt, updatedAt)
             VALUES (:id, :tenantId, :purchaseOrderId, :productId, :quantityOrdered, :quantityReceived, :unitCost, :createdAt, :updatedAt)'
        );
        foreach ($items as $item) {
            $productId = trim((string) ($item['productId'] ?? ''));
            $quantityOrdered = isset($item['quantityOrdered']) ? max(0, (float) $item['quantityOrdered']) : 0.0;
            $unitCost = isset($item['unitCost']) ? max(0, (float) $item['unitCost']) : 0.0;
            if ($productId === '' || $quantityOrdered <= 0) {
                error_response('Purchase order items need a product and quantity greater than zero');
            }

            $productStatement->execute([
                'id' => $productId,
                'tenantId' => $authUser['tenantId'],
                'branchId' => $branchId,
            ]);
            if (!db_one($productStatement)) {
                error_response('One of the selected products was not found in the branch', 404, 'not_found');
            }

            $itemInsert->execute([
                'id' => app_id(),
                'tenantId' => $authUser['tenantId'],
                'purchaseOrderId' => $purchaseOrderId,
                'productId' => $productId,
                'quantityOrdered' => phase2_decimal_string($quantityOrdered),
                'quantityReceived' => 0,
                'unitCost' => phase2_decimal_string($unitCost),
                'createdAt' => $now,
                'updatedAt' => $now,
            ]);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    $statement = $pdo->prepare(
        'SELECT po.*, b.name AS branchName, s.name AS supplierName
         FROM PurchaseOrder po
         INNER JOIN Branch b ON b.id = po.branchId
         INNER JOIN Supplier s ON s.id = po.supplierId
         WHERE po.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $purchaseOrderId]);
    json_response(phase2_purchase_order_payload($pdo, (array) db_one($statement)), 201);
}

if ($method === 'POST' && preg_match('#^/api/v1/tenant-management/purchase-orders/([^/]+)/receive$#', $path, $matches) === 1) {
    $authUser = require_management_workspace(authenticated_user());
    $purchaseOrderId = trim((string) $matches[1]);
    $payload = json_input();
    $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
    if (!$items) {
        error_response('At least one received purchase order item is required');
    }

    $statement = $pdo->prepare(
        'SELECT po.*, b.name AS branchName, s.name AS supplierName
         FROM PurchaseOrder po
         INNER JOIN Branch b ON b.id = po.branchId
         INNER JOIN Supplier s ON s.id = po.supplierId
         WHERE po.id = :id
           AND po.tenantId = :tenantId
         LIMIT 1'
    );
    $statement->execute([
        'id' => $purchaseOrderId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $purchaseOrder = db_one($statement);
    if (!$purchaseOrder) {
        error_response('Purchase order not found in the active workspace', 404, 'not_found');
    }

    $now = now_string();
    $pdo->beginTransaction();
    try {
        foreach ($items as $item) {
            $purchaseOrderItemId = trim((string) ($item['purchaseOrderItemId'] ?? ''));
            $quantityReceived = isset($item['quantityReceived']) ? max(0, (float) $item['quantityReceived']) : 0.0;
            if ($purchaseOrderItemId === '' || $quantityReceived <= 0) {
                error_response('Received purchase order items need a line item and quantity greater than zero');
            }

            $itemStatement = $pdo->prepare(
                'SELECT poi.*, i.id AS inventoryId, i.quantityOnHand, i.reorderLevel
                 FROM PurchaseOrderItem poi
                 INNER JOIN Product p ON p.id = poi.productId
                 INNER JOIN InventoryItem i ON i.productId = p.id
                 WHERE poi.id = :id
                   AND poi.purchaseOrderId = :purchaseOrderId
                   AND poi.tenantId = :tenantId
                 LIMIT 1'
            );
            $itemStatement->execute([
                'id' => $purchaseOrderItemId,
                'purchaseOrderId' => $purchaseOrderId,
                'tenantId' => $authUser['tenantId'],
            ]);
            $purchaseOrderItem = db_one($itemStatement);
            if (!$purchaseOrderItem) {
                error_response('Purchase order item not found in the selected order', 404, 'not_found');
            }

            $nextReceived = (float) $purchaseOrderItem['quantityReceived'] + $quantityReceived;
            if ($nextReceived - (float) $purchaseOrderItem['quantityOrdered'] > 0.00001) {
                error_response('Received quantity cannot exceed the ordered quantity', 409, 'conflict');
            }

            $nextInventoryQuantity = (float) $purchaseOrderItem['quantityOnHand'] + $quantityReceived;
            $reorderLevel = $purchaseOrderItem['reorderLevel'] !== null ? (float) $purchaseOrderItem['reorderLevel'] : null;
            $inventoryStatus = phase2_current_inventory_status($nextInventoryQuantity, $reorderLevel);

            $itemUpdate = $pdo->prepare(
                'UPDATE PurchaseOrderItem
                 SET quantityReceived = :quantityReceived, updatedAt = :updatedAt
                 WHERE id = :id'
            );
            $itemUpdate->execute([
                'quantityReceived' => phase2_decimal_string($nextReceived),
                'updatedAt' => $now,
                'id' => $purchaseOrderItemId,
            ]);

            $inventoryUpdate = $pdo->prepare(
                'UPDATE InventoryItem
                 SET quantityOnHand = :quantityOnHand, status = :status, updatedAt = :updatedAt
                 WHERE id = :id'
            );
            $inventoryUpdate->execute([
                'quantityOnHand' => phase2_decimal_string($nextInventoryQuantity),
                'status' => $inventoryStatus,
                'updatedAt' => $now,
                'id' => $purchaseOrderItem['inventoryId'],
            ]);
        }

        $remainingStatement = $pdo->prepare(
            'SELECT COUNT(*) AS remainingCount
             FROM PurchaseOrderItem
             WHERE purchaseOrderId = :purchaseOrderId
               AND tenantId = :tenantId
               AND quantityReceived < quantityOrdered'
        );
        $remainingStatement->execute([
            'purchaseOrderId' => $purchaseOrderId,
            'tenantId' => $authUser['tenantId'],
        ]);
        $remainingCount = (int) ((db_one($remainingStatement)['remainingCount'] ?? 0));

        $poUpdate = $pdo->prepare(
            'UPDATE PurchaseOrder
             SET status = :status, receivedAt = :receivedAt, updatedAt = :updatedAt
             WHERE id = :id'
        );
        $poUpdate->execute([
            'status' => $remainingCount === 0 ? 'received' : 'ordered',
            'receivedAt' => $remainingCount === 0 ? $now : null,
            'updatedAt' => $now,
            'id' => $purchaseOrderId,
        ]);

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    $statement->execute([
        'id' => $purchaseOrderId,
        'tenantId' => $authUser['tenantId'],
    ]);
    json_response(phase2_purchase_order_payload($pdo, (array) db_one($statement)));
}
