<?php

declare(strict_types=1);

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'bootstrap.php';

$pdo = pdo_connection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if (($prefixPosition = strpos($path, '/api/v1/')) !== false) {
    $path = substr($path, $prefixPosition);
}

function load_appointment_summary(PDO $pdo, string $tenantId, string $appointmentId): ?array
{
    $statement = $pdo->prepare(
        'SELECT a.id, a.branchId, b.name AS branchName, a.customerId, c.fullName AS customerName, c.phone AS customerPhone,
                a.roomId, r.name AS roomName, a.employeeId, u.email AS employeeEmail, ep.employeeCode,
                a.status, a.source, a.notes, a.startAt, a.endAt,
                a.checkInAt, a.checkOutAt, a.createdAt
         FROM Appointment a
         INNER JOIN Branch b ON b.id = a.branchId
         INNER JOIN CustomerProfile c ON c.id = a.customerId
         LEFT JOIN Room r ON r.id = a.roomId
         LEFT JOIN EmployeeProfile ep ON ep.id = a.employeeId
         LEFT JOIN User u ON u.id = ep.userId
         WHERE a.tenantId = :tenantId AND a.id = :id
         LIMIT 1'
    );
    $statement->execute([
        'tenantId' => $tenantId,
        'id' => $appointmentId,
    ]);
    $appointment = db_one($statement);

    if (!$appointment) {
        return null;
    }

    $lineStatement = $pdo->prepare(
        'SELECT al.id, al.serviceId, s.name AS serviceName, s.code AS serviceCode,
                al.durationMinutes, al.unitPrice, al.status
         FROM AppointmentLine al
         INNER JOIN Service s ON s.id = al.serviceId
         WHERE al.appointmentId = :appointmentId
         ORDER BY al.createdAt ASC'
    );
    $lineStatement->execute(['appointmentId' => $appointmentId]);
    $lines = $lineStatement->fetchAll();

    return [
        'id' => $appointment['id'],
        'branchId' => $appointment['branchId'],
        'branchName' => $appointment['branchName'],
        'customerId' => $appointment['customerId'],
        'customerName' => $appointment['customerName'],
        'customerPhone' => $appointment['customerPhone'],
        'roomId' => $appointment['roomId'],
        'roomName' => $appointment['roomName'],
        'employeeId' => $appointment['employeeId'],
        'employeeEmail' => $appointment['employeeEmail'],
        'employeeCode' => $appointment['employeeCode'],
        'status' => $appointment['status'],
        'source' => $appointment['source'],
        'notes' => $appointment['notes'],
        'startAt' => $appointment['startAt'],
        'endAt' => $appointment['endAt'],
        'checkInAt' => $appointment['checkInAt'],
        'checkOutAt' => $appointment['checkOutAt'],
        'createdAt' => $appointment['createdAt'],
        'lines' => array_map(static function (array $line): array {
            return [
                'id' => $line['id'],
                'serviceId' => $line['serviceId'],
                'serviceName' => $line['serviceName'],
                'serviceCode' => $line['serviceCode'],
                'durationMinutes' => (int) $line['durationMinutes'],
                'unitPrice' => (string) $line['unitPrice'],
                'status' => $line['status'],
            ];
        }, $lines),
    ];
}

function assert_branch_belongs_to_tenant(PDO $pdo, string $tenantId, string $branchId): array
{
    $statement = $pdo->prepare(
        'SELECT id, name
         FROM Branch
         WHERE id = :id AND tenantId = :tenantId
         LIMIT 1'
    );
    $statement->execute([
        'id' => $branchId,
        'tenantId' => $tenantId,
    ]);

    $branch = db_one($statement);
    if (!$branch) {
        error_response('Branch not found in the active workspace');
    }

    return $branch;
}

function load_public_tenant(PDO $pdo, string $tenantSlug): array
{
    $statement = $pdo->prepare(
        'SELECT id, name, slug, ownerUserId, timezone, currency, status
         FROM Tenant
         WHERE slug = :slug
           AND status IN (\'trial\', \'active\', \'past_due\', \'grace_period\')
         LIMIT 1'
    );
    $statement->execute(['slug' => $tenantSlug]);
    $tenant = db_one($statement);
    if (!$tenant) {
        error_response('Workspace not available for customer booking', 404, 'not_found');
    }

    return $tenant;
}

function module_entitlements_payload(PDO $pdo, string $tenantId): array
{
    $modules = workspace_policy_json(
        $pdo,
        $tenantId,
        'tenant.modules',
        [
            'inventory' => true,
            'employeeCredit' => true,
            'notifications' => true,
            'customerAccounts' => true,
        ]
    );

    return [
        'inventory' => !empty($modules['inventory']),
        'employeeCredit' => !empty($modules['employeeCredit']),
        'notifications' => !empty($modules['notifications']),
        'customerAccounts' => !empty($modules['customerAccounts']),
    ];
}

function require_enabled_module(
    PDO $pdo,
    string $tenantId,
    string $moduleKey,
    string $message = 'This feature is not enabled for the active workspace'
): void {
    $modules = module_entitlements_payload($pdo, $tenantId);
    if (empty($modules[$moduleKey])) {
        error_response($message, 403, 'module_disabled');
    }
}

function superadmin_tenant_detail_payload(PDO $pdo, string $tenantId): array
{
    $statement = $pdo->prepare(
        'SELECT t.id, t.name, t.slug, t.status, t.timezone, t.currency, t.country, t.trialEndsAt, t.activatedAt,
                t.suspendedAt, t.createdAt, owner.email AS ownerEmail,
                (SELECT COUNT(*) FROM Branch b WHERE b.tenantId = t.id) AS branchCount,
                (SELECT COUNT(*) FROM EmployeeProfile ep WHERE ep.tenantId = t.id AND ep.employmentStatus = \'active\') AS employeeCount,
                (SELECT COUNT(*) FROM Appointment a WHERE a.tenantId = t.id) AS appointmentCount,
                (SELECT s.planCode FROM Subscription s WHERE s.tenantId = t.id ORDER BY s.createdAt DESC LIMIT 1) AS currentPlanCode,
                (SELECT s.status FROM Subscription s WHERE s.tenantId = t.id ORDER BY s.createdAt DESC LIMIT 1) AS subscriptionStatus,
                (SELECT s.renewsAt FROM Subscription s WHERE s.tenantId = t.id ORDER BY s.createdAt DESC LIMIT 1) AS renewsAt,
                (SELECT s.graceEndsAt FROM Subscription s WHERE s.tenantId = t.id ORDER BY s.createdAt DESC LIMIT 1) AS graceEndsAt
         FROM Tenant t
         INNER JOIN User owner ON owner.id = t.ownerUserId
         WHERE t.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $tenantId]);
    $tenant = db_one($statement);
    if (!$tenant) {
        error_response('Tenant not found', 404, 'not_found');
    }

    $invoiceStatement = $pdo->prepare(
        'SELECT id, invoiceNumber, status, totalAmount, dueAt, issuedAt
         FROM Invoice
         WHERE tenantId = :tenantId
         ORDER BY createdAt DESC
         LIMIT 1'
    );
    $invoiceStatement->execute(['tenantId' => $tenantId]);
    $invoice = db_one($invoiceStatement);

    $paymentStatement = $pdo->prepare(
        'SELECT p.id, p.paymentMethod, p.amount, p.status, p.providerReference, p.receivedAt AS paidAt
         FROM Payment p
         INNER JOIN Invoice i ON i.id = p.invoiceId
         WHERE p.tenantId = :tenantId
         ORDER BY p.createdAt DESC
         LIMIT 1'
    );
    $paymentStatement->execute(['tenantId' => $tenantId]);
    $payment = db_one($paymentStatement);

    return [
        'id' => $tenant['id'],
        'name' => $tenant['name'],
        'slug' => $tenant['slug'],
        'status' => $tenant['status'],
        'timezone' => $tenant['timezone'],
        'currency' => $tenant['currency'],
        'country' => $tenant['country'],
        'trialEndsAt' => $tenant['trialEndsAt'] ?? null,
        'activatedAt' => $tenant['activatedAt'] ?? null,
        'suspendedAt' => $tenant['suspendedAt'] ?? null,
        'branchCount' => (int) $tenant['branchCount'],
        'employeeCount' => (int) $tenant['employeeCount'],
        'appointmentCount' => (int) $tenant['appointmentCount'],
        'ownerEmail' => $tenant['ownerEmail'] ?? null,
        'currentPlanCode' => $tenant['currentPlanCode'] ?? null,
        'subscriptionStatus' => $tenant['subscriptionStatus'] ?? null,
        'renewsAt' => $tenant['renewsAt'] ?? null,
        'graceEndsAt' => $tenant['graceEndsAt'] ?? null,
        'createdAt' => $tenant['createdAt'],
        'moduleEntitlements' => module_entitlements_payload($pdo, $tenantId),
        'latestInvoice' => $invoice ? [
            'id' => $invoice['id'],
            'invoiceNumber' => $invoice['invoiceNumber'],
            'status' => $invoice['status'],
            'totalAmount' => (string) $invoice['totalAmount'],
            'dueAt' => $invoice['dueAt'] ?? null,
            'issuedAt' => $invoice['issuedAt'] ?? null,
        ] : null,
        'latestPayment' => $payment ? [
            'id' => $payment['id'],
            'paymentMethod' => $payment['paymentMethod'],
            'amount' => (string) $payment['amount'],
            'status' => $payment['status'],
            'providerReference' => $payment['providerReference'] ?? null,
            'paidAt' => $payment['paidAt'] ?? null,
        ] : null,
    ];
}

function tenant_billing_summary_payload(PDO $pdo, string $tenantId): array
{
    $detail = superadmin_tenant_detail_payload($pdo, $tenantId);

    $invoiceStatement = $pdo->prepare(
        'SELECT id, invoiceNumber, status, totalAmount, dueAt, issuedAt, createdAt
         FROM Invoice
         WHERE tenantId = :tenantId
         ORDER BY createdAt DESC
         LIMIT 10'
    );
    $invoiceStatement->execute(['tenantId' => $tenantId]);

    $paymentStatement = $pdo->prepare(
        'SELECT p.id, p.invoiceId, i.invoiceNumber, p.paymentMethod, p.amount, p.status, p.providerReference, p.receivedAt AS paidAt, p.createdAt
         FROM Payment p
         INNER JOIN Invoice i ON i.id = p.invoiceId
         WHERE p.tenantId = :tenantId
         ORDER BY p.createdAt DESC
         LIMIT 10'
    );
    $paymentStatement->execute(['tenantId' => $tenantId]);

    return [
        'tenantId' => $detail['id'],
        'tenantName' => $detail['name'],
        'tenantStatus' => $detail['status'],
        'currency' => $detail['currency'],
        'currentPlanCode' => $detail['currentPlanCode'] ?? null,
        'subscriptionStatus' => $detail['subscriptionStatus'] ?? null,
        'trialEndsAt' => $detail['trialEndsAt'] ?? null,
        'renewsAt' => $detail['renewsAt'] ?? null,
        'graceEndsAt' => $detail['graceEndsAt'] ?? null,
        'latestInvoice' => $detail['latestInvoice'] ?? null,
        'latestPayment' => $detail['latestPayment'] ?? null,
        'recentInvoices' => array_map(static function (array $row): array {
            return [
                'id' => $row['id'],
                'invoiceNumber' => $row['invoiceNumber'],
                'status' => $row['status'],
                'totalAmount' => (string) $row['totalAmount'],
                'dueAt' => $row['dueAt'] ?? null,
                'issuedAt' => $row['issuedAt'] ?? null,
                'createdAt' => $row['createdAt'],
            ];
        }, $invoiceStatement->fetchAll()),
        'recentPayments' => array_map(static function (array $row): array {
            return [
                'id' => $row['id'],
                'invoiceId' => $row['invoiceId'],
                'invoiceNumber' => $row['invoiceNumber'] ?? null,
                'paymentMethod' => $row['paymentMethod'],
                'amount' => (string) $row['amount'],
                'status' => $row['status'],
                'providerReference' => $row['providerReference'] ?? null,
                'paidAt' => $row['paidAt'] ?? null,
                'createdAt' => $row['createdAt'],
            ];
        }, $paymentStatement->fetchAll()),
    ];
}

function customer_profile_payload(PDO $pdo, array $profile): array
{
    $preferences = null;
    if (!empty($profile['preferencesJson'])) {
        $decoded = json_decode((string) $profile['preferencesJson'], true);
        $preferences = is_array($decoded) ? $decoded : null;
    }

    return [
        'id' => $profile['id'],
        'tenantId' => $profile['tenantId'],
        'tenantName' => $profile['tenantName'],
        'tenantSlug' => $profile['tenantSlug'],
        'primaryBranchId' => $profile['primaryBranchId'] ?? null,
        'fullName' => $profile['fullName'],
        'phone' => $profile['phone'] ?? null,
        'email' => $profile['email'] ?? null,
        'dateOfBirth' => $profile['dateOfBirth'] ?? null,
        'preferences' => $preferences,
        'notes' => $profile['notes'] ?? null,
        'marketingConsent' => (bool) ($profile['marketingConsent'] ?? false),
        'createdAt' => $profile['createdAt'],
    ];
}

function waitlist_payload(array $entry): array
{
    return [
        'id' => $entry['id'],
        'tenantId' => $entry['tenantId'],
        'branchId' => $entry['branchId'],
        'customerId' => $entry['customerId'],
        'customerName' => $entry['customerName'],
        'customerPhone' => $entry['customerPhone'] ?? null,
        'serviceId' => $entry['serviceId'],
        'serviceName' => $entry['serviceName'],
        'serviceCode' => $entry['serviceCode'],
        'status' => $entry['status'],
        'preferredStartAt' => $entry['preferredStartAt'] ?? null,
        'note' => $entry['note'] ?? null,
        'contactedAt' => $entry['contactedAt'] ?? null,
        'promotedAt' => $entry['promotedAt'] ?? null,
        'closedAt' => $entry['closedAt'] ?? null,
        'createdAt' => $entry['createdAt'],
    ];
}

function support_ticket_payload(array $ticket): array
{
    return [
        'id' => $ticket['id'],
        'tenantId' => $ticket['tenantId'],
        'tenantName' => $ticket['tenantName'] ?? null,
        'branchId' => $ticket['branchId'] ?? null,
        'branchName' => $ticket['branchName'] ?? null,
        'requesterUserId' => $ticket['requesterUserId'],
        'requesterEmail' => $ticket['requesterEmail'] ?? null,
        'assignedToUserId' => $ticket['assignedToUserId'] ?? null,
        'assignedToEmail' => $ticket['assignedToEmail'] ?? null,
        'subject' => $ticket['subject'],
        'body' => $ticket['body'],
        'category' => $ticket['category'],
        'channel' => $ticket['channel'],
        'priority' => $ticket['priority'],
        'status' => $ticket['status'],
        'internalNote' => $ticket['internalNote'] ?? null,
        'resolutionNote' => $ticket['resolutionNote'] ?? null,
        'resolvedAt' => $ticket['resolvedAt'] ?? null,
        'createdAt' => $ticket['createdAt'],
        'updatedAt' => $ticket['updatedAt'],
    ];
}

function superadmin_tenant_usage_collection(PDO $pdo, ?string $tenantId = null): array
{
    $windowStart = add_days(-30);
    $sql = 'SELECT t.id AS tenantId, t.name AS tenantName, t.slug AS tenantSlug, t.status AS tenantStatus,
                   (SELECT COUNT(*) FROM Branch b WHERE b.tenantId = t.id) AS branchCount,
                   (SELECT COUNT(*) FROM Service s WHERE s.tenantId = t.id AND s.status = \'active\') AS serviceCount,
                   (SELECT COUNT(*) FROM Product p WHERE p.tenantId = t.id AND p.status = \'active\') AS productCount,
                   (SELECT COUNT(*) FROM EmployeeProfile ep WHERE ep.tenantId = t.id AND ep.employmentStatus = \'active\') AS activeEmployeeCount,
                   (SELECT COUNT(*) FROM CustomerProfile cp WHERE cp.tenantId = t.id) AS customerCount,
                   (SELECT COUNT(*) FROM Appointment a WHERE a.tenantId = t.id AND a.createdAt >= :windowStart) AS appointmentCount30d,
                   (SELECT COUNT(*) FROM Appointment a WHERE a.tenantId = t.id AND a.status = \'completed\' AND a.createdAt >= :windowStart) AS completedAppointmentCount30d,
                   (SELECT COUNT(*) FROM Notification n WHERE n.tenantId = t.id AND n.status = \'unread\') AS unreadNotificationCount,
                   (SELECT COUNT(*) FROM SupportTicket st WHERE st.tenantId = t.id AND st.status IN (\'open\', \'in_progress\', \'waiting_on_customer\')) AS openSupportTicketCount,
                   (SELECT MAX(al.createdAt) FROM AuditLog al WHERE al.tenantId = t.id) AS latestAuditAt,
                   (SELECT MAX(p.receivedAt) FROM Payment p WHERE p.tenantId = t.id AND p.status = \'succeeded\') AS latestPaymentAt
            FROM Tenant t';
    $params = ['windowStart' => $windowStart];

    if ($tenantId !== null) {
        $sql .= ' WHERE t.id = :tenantId';
        $params['tenantId'] = $tenantId;
    }

    $sql .= ' ORDER BY openSupportTicketCount DESC, appointmentCount30d DESC, t.createdAt DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    return array_map(static function (array $row): array {
        return [
            'tenantId' => $row['tenantId'],
            'tenantName' => $row['tenantName'],
            'tenantSlug' => $row['tenantSlug'],
            'tenantStatus' => $row['tenantStatus'],
            'branchCount' => (int) $row['branchCount'],
            'serviceCount' => (int) $row['serviceCount'],
            'productCount' => (int) $row['productCount'],
            'activeEmployeeCount' => (int) $row['activeEmployeeCount'],
            'customerCount' => (int) $row['customerCount'],
            'appointmentCount30d' => (int) $row['appointmentCount30d'],
            'completedAppointmentCount30d' => (int) $row['completedAppointmentCount30d'],
            'unreadNotificationCount' => (int) $row['unreadNotificationCount'],
            'openSupportTicketCount' => (int) $row['openSupportTicketCount'],
            'latestAuditAt' => $row['latestAuditAt'] ?? null,
            'latestPaymentAt' => $row['latestPaymentAt'] ?? null,
        ];
    }, $statement->fetchAll());
}

function operations_report_payload(
    PDO $pdo,
    string $tenantId,
    ?string $branchId,
    string $fromDate,
    string $toDate
): array {
    $fromStart = new DateTimeImmutable(iso_date_string($fromDate) . ' 00:00:00', new DateTimeZone('UTC'));
    $toEndExclusive = (new DateTimeImmutable(iso_date_string($toDate) . ' 00:00:00', new DateTimeZone('UTC')))
        ->modify('+1 day');
    $rangeParams = [
        'tenantId' => $tenantId,
        'fromStart' => format_datetime($fromStart),
        'toEndExclusive' => format_datetime($toEndExclusive),
    ];

    $branchSql = '';
    if ($branchId) {
        $branchSql = ' AND a.branchId = :branchId';
        $rangeParams['branchId'] = $branchId;
    }

    $revenueStatement = $pdo->prepare(
        'SELECT b.id AS branchId, b.name AS branchName,
                COALESCE(SUM(al.unitPrice), 0) AS completedRevenue,
                COUNT(DISTINCT a.id) AS completedAppointments
         FROM Branch b
         LEFT JOIN Appointment a
           ON a.branchId = b.id
          AND a.tenantId = :tenantId
          AND a.status = \'completed\'
          AND a.startAt >= :fromStart
          AND a.startAt < :toEndExclusive' . $branchSql . '
         LEFT JOIN AppointmentLine al
           ON al.appointmentId = a.id
          AND al.tenantId = :tenantId
         WHERE b.tenantId = :tenantId' . ($branchId ? ' AND b.id = :branchId' : '') . '
         GROUP BY b.id, b.name
         ORDER BY b.name ASC'
    );
    $revenueStatement->execute($rangeParams);
    $revenueByBranch = array_map(static function (array $row): array {
        return [
            'branchId' => $row['branchId'],
            'branchName' => $row['branchName'],
            'completedRevenue' => number_format((float) $row['completedRevenue'], 2, '.', ''),
            'completedAppointments' => (int) $row['completedAppointments'],
        ];
    }, $revenueStatement->fetchAll());

    $volumeStatement = $pdo->prepare(
        'SELECT DATE(a.startAt) AS reportDate,
                COUNT(*) AS createdAppointments,
                SUM(CASE WHEN a.status = \'completed\' THEN 1 ELSE 0 END) AS completedAppointments,
                SUM(CASE WHEN a.status = \'canceled\' THEN 1 ELSE 0 END) AS canceledAppointments,
                SUM(CASE WHEN a.status = \'no_show\' THEN 1 ELSE 0 END) AS noShowAppointments
         FROM Appointment a
         WHERE a.tenantId = :tenantId
           AND a.startAt >= :fromStart
           AND a.startAt < :toEndExclusive' . $branchSql . '
         GROUP BY DATE(a.startAt)
         ORDER BY reportDate ASC'
    );
    $volumeStatement->execute($rangeParams);
    $appointmentVolumeByDay = array_map(static function (array $row): array {
        return [
            'date' => $row['reportDate'],
            'createdAppointments' => (int) $row['createdAppointments'],
            'completedAppointments' => (int) $row['completedAppointments'],
            'canceledAppointments' => (int) $row['canceledAppointments'],
            'noShowAppointments' => (int) $row['noShowAppointments'],
        ];
    }, $volumeStatement->fetchAll());

    $inventoryStatement = $pdo->prepare(
        'SELECT b.id AS branchId, b.name AS branchName,
                COUNT(i.id) AS totalItems,
                SUM(CASE
                      WHEN i.id IS NOT NULL
                       AND i.reorderLevel IS NOT NULL
                       AND i.quantityOnHand <= i.reorderLevel
                       AND i.quantityOnHand > 0
                      THEN 1 ELSE 0
                    END) AS lowStockItems,
                SUM(CASE WHEN i.id IS NOT NULL AND i.quantityOnHand <= 0 THEN 1 ELSE 0 END) AS outOfStockItems
         FROM Branch b
         LEFT JOIN InventoryItem i
           ON i.branchId = b.id
          AND i.tenantId = :tenantId
         WHERE b.tenantId = :tenantId' . ($branchId ? ' AND b.id = :branchId' : '') . '
         GROUP BY b.id, b.name
         ORDER BY b.name ASC'
    );
    $inventoryStatement->execute($branchId ? ['tenantId' => $tenantId, 'branchId' => $branchId] : ['tenantId' => $tenantId]);
    $inventoryByBranch = array_map(static function (array $row): array {
        return [
            'branchId' => $row['branchId'],
            'branchName' => $row['branchName'],
            'totalItems' => (int) $row['totalItems'],
            'lowStockItems' => (int) $row['lowStockItems'],
            'outOfStockItems' => (int) $row['outOfStockItems'],
        ];
    }, $inventoryStatement->fetchAll());

    $totalsStatement = $pdo->prepare(
        'SELECT
            COALESCE(SUM(CASE WHEN a.status = \'completed\' THEN al.unitPrice ELSE 0 END), 0) AS completedRevenue,
            SUM(CASE WHEN a.status = \'completed\' THEN 1 ELSE 0 END) AS completedAppointments,
            COUNT(DISTINCT a.id) AS createdAppointments,
            COUNT(DISTINCT a.customerId) AS activeCustomers
         FROM Appointment a
         LEFT JOIN AppointmentLine al
           ON al.appointmentId = a.id
          AND al.tenantId = :tenantId
         WHERE a.tenantId = :tenantId
           AND a.startAt >= :fromStart
           AND a.startAt < :toEndExclusive' . $branchSql
    );
    $totalsStatement->execute($rangeParams);
    $totals = db_one($totalsStatement) ?: [];

    return [
        'branchId' => $branchId,
        'fromDate' => iso_date_string($fromDate),
        'toDate' => iso_date_string($toDate),
        'totals' => [
            'completedRevenue' => number_format((float) ($totals['completedRevenue'] ?? 0), 2, '.', ''),
            'completedAppointments' => (int) ($totals['completedAppointments'] ?? 0),
            'createdAppointments' => (int) ($totals['createdAppointments'] ?? 0),
            'activeCustomers' => (int) ($totals['activeCustomers'] ?? 0),
            'totalInventoryItems' => array_sum(array_column($inventoryByBranch, 'totalItems')),
            'lowStockItems' => array_sum(array_column($inventoryByBranch, 'lowStockItems')),
            'outOfStockItems' => array_sum(array_column($inventoryByBranch, 'outOfStockItems')),
        ],
        'revenueByBranch' => $revenueByBranch,
        'appointmentVolumeByDay' => $appointmentVolumeByDay,
        'inventoryByBranch' => $inventoryByBranch,
    ];
}

function storage_path(string $relativePath): string
{
    $base = env_value('STORAGE_BASE_PATH', './storage') ?? './storage';
    if (!preg_match('#^[A-Za-z]:\\\\#', $base) && !str_starts_with($base, DIRECTORY_SEPARATOR)) {
        $base = app_root_path() . DIRECTORY_SEPARATOR . ltrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $base), DIRECTORY_SEPARATOR);
    }

    return rtrim($base, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . ltrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath), DIRECTORY_SEPARATOR);
}

function ensure_directory(string $path): void
{
    if (is_dir($path)) {
        return;
    }

    @mkdir($path, 0775, true);
}

function append_email_outbox(array $payload): void
{
    $filePath = storage_path('notifications/email-outbox.log');
    ensure_directory(dirname($filePath));
    @file_put_contents($filePath, json_encode($payload, JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND);
}

function deliver_email_notification(string $email, string $subject, string $body, array $metadata = []): void
{
    if ($email === '') {
        return;
    }

    $from = env_value('EMAIL_FROM_ADDRESS', 'no-reply@example.com') ?? 'no-reply@example.com';
    append_email_outbox([
        'to' => $email,
        'subject' => $subject,
        'body' => $body,
        'metadata' => $metadata,
        'createdAt' => now_string(),
    ]);

    if (function_exists('mail')) {
        $headers = sprintf("From: %s\r\nContent-Type: text/plain; charset=UTF-8", $from);
        @mail($email, $subject, $body, $headers);
    }
}

function create_notification(
    PDO $pdo,
    string $tenantId,
    ?string $branchId,
    string $userId,
    string $type,
    string $title,
    string $body,
    ?string $referenceType = null,
    ?string $referenceId = null
): void {
    $insert = $pdo->prepare(
        'INSERT INTO Notification
         (id, tenantId, branchId, userId, type, title, body, status, referenceType, referenceId, createdAt)
         VALUES (:id, :tenantId, :branchId, :userId, :type, :title, :body, :status, :referenceType, :referenceId, :createdAt)'
    );
    $insert->execute([
        'id' => app_id(),
        'tenantId' => $tenantId,
        'branchId' => $branchId,
        'userId' => $userId,
        'type' => $type,
        'title' => $title,
        'body' => $body,
        'status' => 'unread',
        'referenceType' => $referenceType,
        'referenceId' => $referenceId,
        'createdAt' => now_string(),
    ]);
}

function workspace_notification_recipients(PDO $pdo, string $tenantId, ?string $branchId, array $roleTypes): array
{
    $recipients = [];

    if (in_array('owner', $roleTypes, true)) {
        $ownerStatement = $pdo->prepare(
            'SELECT u.id, u.email
             FROM Tenant t
             INNER JOIN User u ON u.id = t.ownerUserId
             WHERE t.id = :tenantId
             LIMIT 1'
        );
        $ownerStatement->execute(['tenantId' => $tenantId]);
        $owner = db_one($ownerStatement);
        if ($owner) {
            $recipients[$owner['id']] = [
                'userId' => $owner['id'],
                'email' => $owner['email'] ?? '',
            ];
        }
    }

    $nonOwnerRoles = array_values(array_filter($roleTypes, static fn (string $role): bool => $role !== 'owner'));
    if ($nonOwnerRoles) {
        $placeholders = [];
        $params = ['tenantId' => $tenantId];
        foreach ($nonOwnerRoles as $index => $roleType) {
            $key = 'roleType' . $index;
            $placeholders[] = ':' . $key;
            $params[$key] = $roleType;
        }

        $sql = 'SELECT DISTINCT u.id AS userId, u.email
                FROM PermissionGrant pg
                INNER JOIN Role r ON r.id = pg.roleId
                INNER JOIN User u ON u.id = pg.userId
                LEFT JOIN EmployeeProfile ep ON ep.userId = pg.userId AND ep.tenantId = pg.tenantId
                WHERE pg.tenantId = :tenantId
                  AND pg.permissionKey = \'workspace.access\'
                  AND pg.effect = \'allow\'
                  AND r.roleType IN (' . implode(', ', $placeholders) . ')
                  AND (ep.id IS NULL OR ep.employmentStatus = \'active\')';

        if ($branchId !== null) {
            $sql .= ' AND (pg.branchId IS NULL OR pg.branchId = :branchId)';
            $params['branchId'] = $branchId;
        }

        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        foreach ($statement->fetchAll() as $row) {
            $recipients[$row['userId']] = [
                'userId' => $row['userId'],
                'email' => $row['email'] ?? '',
            ];
        }
    }

    return array_values($recipients);
}

function notify_workspace_roles(
    PDO $pdo,
    string $tenantId,
    ?string $branchId,
    array $roleTypes,
    string $type,
    string $title,
    string $body,
    ?string $referenceType = null,
    ?string $referenceId = null
): int {
    $recipients = workspace_notification_recipients($pdo, $tenantId, $branchId, $roleTypes);
    foreach ($recipients as $recipient) {
        create_notification($pdo, $tenantId, $branchId, $recipient['userId'], $type, $title, $body, $referenceType, $referenceId);
        deliver_email_notification($recipient['email'], $title, $body, [
            'tenantId' => $tenantId,
            'branchId' => $branchId,
            'type' => $type,
            'referenceType' => $referenceType,
            'referenceId' => $referenceId,
        ]);
    }

    return count($recipients);
}

function assert_employee_available_for_appointment(
    PDO $pdo,
    string $tenantId,
    string $employeeId,
    string $startAt,
    string $endAt,
    ?string $ignoreAppointmentId = null
): void {
    $sql = 'SELECT id
            FROM Appointment
            WHERE tenantId = :tenantId
              AND employeeId = :employeeId
              AND status IN (\'draft\', \'confirmed\', \'checked_in\', \'in_service\')
              AND startAt < :endAt
              AND endAt > :startAt';
    $params = [
        'tenantId' => $tenantId,
        'employeeId' => $employeeId,
        'startAt' => $startAt,
        'endAt' => $endAt,
    ];

    if ($ignoreAppointmentId) {
        $sql .= ' AND id <> :ignoreAppointmentId';
        $params['ignoreAppointmentId'] = $ignoreAppointmentId;
    }

    $sql .= ' LIMIT 1';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    if (db_one($statement)) {
        error_response('The selected employee is already assigned in that time slot', 409, 'conflict');
    }
}

function assert_room_available_for_appointment(
    PDO $pdo,
    string $tenantId,
    array $room,
    string $startAt,
    string $endAt,
    int $branchCleanupBufferMinutes,
    ?string $ignoreAppointmentId = null
): void {
    $cleanupBufferMinutes = max($branchCleanupBufferMinutes, (int) ($room['cleanupBufferMinutes'] ?? 0));
    $endAtWithCleanup = format_datetime(
        (new DateTimeImmutable($endAt, new DateTimeZone('UTC')))->modify('+' . $cleanupBufferMinutes . ' minutes')
    );

    $sql = 'SELECT id
            FROM Appointment
            WHERE tenantId = :tenantId
              AND roomId = :roomId
              AND status IN (\'draft\', \'confirmed\', \'checked_in\', \'in_service\')
              AND startAt < :endAtWithCleanup
              AND DATE_ADD(endAt, INTERVAL :cleanupBufferMinutes MINUTE) > :startAt';
    $params = [
        'tenantId' => $tenantId,
        'roomId' => $room['id'],
        'startAt' => $startAt,
        'endAtWithCleanup' => $endAtWithCleanup,
        'cleanupBufferMinutes' => $cleanupBufferMinutes,
    ];

    if ($ignoreAppointmentId) {
        $sql .= ' AND id <> :ignoreAppointmentId';
        $params['ignoreAppointmentId'] = $ignoreAppointmentId;
    }

    $sql .= ' LIMIT 1';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    if (db_one($statement)) {
        error_response('The selected room is already occupied in that time slot', 409, 'conflict');
    }
}

function assert_booking_lead_time(DateTimeImmutable $startAt, int $leadTimeMinutes): void
{
    if ($leadTimeMinutes <= 0) {
        return;
    }

    $minimumStart = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->modify('+' . $leadTimeMinutes . ' minutes');

    if ($startAt < $minimumStart) {
        error_response(
            sprintf('Bookings must be made at least %d minutes in advance', $leadTimeMinutes),
            409,
            'conflict'
        );
    }
}

function assert_cancellation_window(DateTimeImmutable $startAt, int $cancellationWindowHours): void
{
    if ($cancellationWindowHours <= 0) {
        return;
    }

    $minimumCancellationAt = $startAt->modify('-' . $cancellationWindowHours . ' hours');
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));

    if ($now >= $minimumCancellationAt) {
        error_response(
            sprintf('Appointments cannot be canceled within %d hours of the scheduled start time', $cancellationWindowHours),
            409,
            'conflict'
        );
    }
}

function attendance_payload(array $record): array
{
    return [
        'id' => $record['id'],
        'branchId' => $record['branchId'],
        'employeeId' => $record['employeeId'],
        'employeeEmail' => $record['employeeEmail'] ?? null,
        'employeeCode' => $record['employeeCode'] ?? null,
        'shiftAssignmentId' => $record['shiftAssignmentId'] ?? null,
        'shiftTemplateName' => $record['shiftTemplateName'] ?? null,
        'attendanceStatus' => $record['attendanceStatus'],
        'networkIdentifier' => $record['networkIdentifier'],
        'gpsLatitude' => isset($record['gpsLatitude']) ? (string) $record['gpsLatitude'] : null,
        'gpsLongitude' => isset($record['gpsLongitude']) ? (string) $record['gpsLongitude'] : null,
        'latenessMinutes' => (int) $record['latenessMinutes'],
        'exceptionFlag' => (bool) $record['exceptionFlag'],
        'checkInAt' => $record['checkInAt'],
        'checkOutAt' => $record['checkOutAt'],
        'createdAt' => $record['createdAt'],
    ];
}

function employee_payload(array $row): array
{
    return [
        'id' => $row['id'],
        'userId' => $row['userId'],
        'email' => $row['email'],
        'phone' => $row['phone'] ?? null,
        'employeeCode' => $row['employeeCode'],
        'roleType' => $row['roleType'] ?? 'employee',
        'primaryBranchId' => $row['primaryBranchId'],
        'employmentStatus' => $row['employmentStatus'],
        'creditEligible' => (bool) $row['creditEligible'],
        'canEarnCommission' => (bool) $row['canEarnCommission'],
        'createdAt' => $row['createdAt'],
    ];
}

function inventory_item_payload(array $row): array
{
    return [
        'id' => $row['inventoryId'] ?? $row['id'],
        'productId' => $row['productId'],
        'quantityOnHand' => (string) $row['quantityOnHand'],
        'reorderLevel' => isset($row['reorderLevel']) ? (string) $row['reorderLevel'] : null,
        'status' => $row['inventoryStatus'] ?? $row['status'],
        'lastCountedAt' => $row['lastCountedAt'] ?? null,
        'updatedAt' => $row['inventoryUpdatedAt'] ?? $row['updatedAt'] ?? null,
    ];
}

function product_payload(array $row): array
{
    $inventoryItem = null;
    if (!empty($row['inventoryId'])) {
        $inventoryItem = inventory_item_payload($row);
    }

    return [
        'id' => $row['id'],
        'branchId' => $row['branchId'],
        'name' => $row['name'],
        'sku' => $row['sku'],
        'description' => $row['description'] ?? null,
        'unitPrice' => (string) $row['unitPrice'],
        'costPrice' => isset($row['costPrice']) ? (string) $row['costPrice'] : null,
        'status' => $row['status'],
        'isRetail' => (bool) $row['isRetail'],
        'inventoryItem' => $inventoryItem,
    ];
}

function inventory_payload(array $row): array
{
    return [
        'id' => $row['inventoryId'] ?? $row['id'],
        'branchId' => $row['branchId'],
        'productId' => $row['productId'],
        'productName' => $row['productName'] ?? $row['name'],
        'productSku' => $row['productSku'] ?? $row['sku'],
        'productDescription' => $row['productDescription'] ?? $row['description'] ?? null,
        'unitPrice' => (string) $row['unitPrice'],
        'costPrice' => isset($row['costPrice']) ? (string) $row['costPrice'] : null,
        'isRetail' => (bool) $row['isRetail'],
        'quantityOnHand' => (string) $row['quantityOnHand'],
        'reorderLevel' => isset($row['reorderLevel']) ? (string) $row['reorderLevel'] : null,
        'status' => $row['inventoryStatus'] ?? $row['status'],
        'lastCountedAt' => $row['lastCountedAt'] ?? null,
        'updatedAt' => $row['inventoryUpdatedAt'] ?? $row['updatedAt'] ?? null,
    ];
}

function workspace_policy_json(PDO $pdo, string $tenantId, string $policyKey, array $default): array
{
    $statement = $pdo->prepare(
        'SELECT policyValueJson
         FROM WorkspacePolicy
         WHERE tenantId = :tenantId
           AND policyKey = :policyKey
           AND isActive = 1
         ORDER BY version DESC, effectiveFrom DESC, createdAt DESC
         LIMIT 1'
    );
    $statement->execute([
        'tenantId' => $tenantId,
        'policyKey' => $policyKey,
    ]);
    $row = db_one($statement);
    if (!$row) {
        return $default;
    }

    $value = $row['policyValueJson'] ?? null;
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : $default;
    }

    return is_array($value) ? $value : $default;
}

function upsert_workspace_policy(PDO $pdo, string $tenantId, string $policyKey, array $policyValue): void
{
    $lookup = $pdo->prepare(
        'SELECT id, version
         FROM WorkspacePolicy
         WHERE tenantId = :tenantId
           AND policyKey = :policyKey
           AND isActive = 1
         ORDER BY version DESC, effectiveFrom DESC, createdAt DESC
         LIMIT 1'
    );
    $lookup->execute([
        'tenantId' => $tenantId,
        'policyKey' => $policyKey,
    ]);
    $existing = db_one($lookup);
    $now = now_string();

    if ($existing) {
        $update = $pdo->prepare(
            'UPDATE WorkspacePolicy
             SET policyValueJson = :policyValueJson,
                 version = :version,
                 effectiveFrom = :effectiveFrom,
                 updatedAt = :updatedAt
             WHERE id = :id'
        );
        $update->execute([
            'policyValueJson' => json_encode($policyValue, JSON_UNESCAPED_SLASHES),
            'version' => ((int) $existing['version']) + 1,
            'effectiveFrom' => $now,
            'updatedAt' => $now,
            'id' => $existing['id'],
        ]);
        return;
    }

    $insert = $pdo->prepare(
        'INSERT INTO WorkspacePolicy (id, tenantId, policyKey, policyValueJson, version, isActive, effectiveFrom, createdAt, updatedAt)
         VALUES (:id, :tenantId, :policyKey, :policyValueJson, 1, 1, :effectiveFrom, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => app_id(),
        'tenantId' => $tenantId,
        'policyKey' => $policyKey,
        'policyValueJson' => json_encode($policyValue, JSON_UNESCAPED_SLASHES),
        'effectiveFrom' => $now,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);
}

function branch_policy_json(PDO $pdo, string $tenantId, string $branchId, string $policyKey, array $default): array
{
    $statement = $pdo->prepare(
        'SELECT policyValueJson
         FROM BranchPolicy
         WHERE tenantId = :tenantId
           AND branchId = :branchId
           AND policyKey = :policyKey
           AND isActive = 1
         ORDER BY version DESC, effectiveFrom DESC, createdAt DESC
         LIMIT 1'
    );
    $statement->execute([
        'tenantId' => $tenantId,
        'branchId' => $branchId,
        'policyKey' => $policyKey,
    ]);
    $row = db_one($statement);
    if (!$row) {
        return $default;
    }

    $value = $row['policyValueJson'] ?? null;
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : $default;
    }

    return is_array($value) ? $value : $default;
}

function upsert_branch_policy(PDO $pdo, string $tenantId, string $branchId, string $policyKey, array $policyValue): void
{
    $lookup = $pdo->prepare(
        'SELECT id, version
         FROM BranchPolicy
         WHERE tenantId = :tenantId
           AND branchId = :branchId
           AND policyKey = :policyKey
           AND isActive = 1
         ORDER BY version DESC, effectiveFrom DESC, createdAt DESC
         LIMIT 1'
    );
    $lookup->execute([
        'tenantId' => $tenantId,
        'branchId' => $branchId,
        'policyKey' => $policyKey,
    ]);
    $existing = db_one($lookup);
    $now = now_string();

    if ($existing) {
        $update = $pdo->prepare(
            'UPDATE BranchPolicy
             SET policyValueJson = :policyValueJson,
                 version = :version,
                 effectiveFrom = :effectiveFrom,
                 updatedAt = :updatedAt
             WHERE id = :id'
        );
        $update->execute([
            'policyValueJson' => json_encode($policyValue, JSON_UNESCAPED_SLASHES),
            'version' => ((int) $existing['version']) + 1,
            'effectiveFrom' => $now,
            'updatedAt' => $now,
            'id' => $existing['id'],
        ]);
        return;
    }

    $insert = $pdo->prepare(
        'INSERT INTO BranchPolicy (id, tenantId, branchId, policyKey, policyValueJson, version, isActive, effectiveFrom, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :policyKey, :policyValueJson, 1, 1, :effectiveFrom, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => app_id(),
        'tenantId' => $tenantId,
        'branchId' => $branchId,
        'policyKey' => $policyKey,
        'policyValueJson' => json_encode($policyValue, JSON_UNESCAPED_SLASHES),
        'effectiveFrom' => $now,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);
}

function booking_policy_payload(PDO $pdo, string $tenantId, ?string $branchId = null): array
{
    $workspaceCancellation = workspace_policy_json(
        $pdo,
        $tenantId,
        'booking.cancellationWindowHours',
        ['hours' => 4]
    );
    $workspaceLeadTime = workspace_policy_json(
        $pdo,
        $tenantId,
        'booking.leadTimeMinutes',
        ['minutes' => 120]
    );
    $workspaceCleanup = workspace_policy_json(
        $pdo,
        $tenantId,
        'booking.cleanupBufferMinutes',
        ['minutes' => 0]
    );

    $branchCancellation = $branchId
        ? branch_policy_json($pdo, $tenantId, $branchId, 'booking.cancellationWindowHours', ['useWorkspaceDefault' => true])
        : ['useWorkspaceDefault' => true];
    $branchLeadTime = $branchId
        ? branch_policy_json($pdo, $tenantId, $branchId, 'booking.leadTimeMinutes', ['useWorkspaceDefault' => true])
        : ['useWorkspaceDefault' => true];
    $branchCleanup = $branchId
        ? branch_policy_json($pdo, $tenantId, $branchId, 'booking.cleanupBufferMinutes', ['useWorkspaceDefault' => true])
        : ['useWorkspaceDefault' => true];

    $useWorkspaceCancellation = !$branchId || !empty($branchCancellation['useWorkspaceDefault']);
    $useWorkspaceLeadTime = !$branchId || !empty($branchLeadTime['useWorkspaceDefault']);
    $useWorkspaceCleanup = !$branchId || !empty($branchCleanup['useWorkspaceDefault']);

    return [
        'branchId' => $branchId,
        'bookingCancellationWindowHours' => $useWorkspaceCancellation
            ? max(0, (int) ($workspaceCancellation['hours'] ?? 4))
            : max(0, (int) ($branchCancellation['hours'] ?? $workspaceCancellation['hours'] ?? 4)),
        'bookingLeadTimeMinutes' => $useWorkspaceLeadTime
            ? max(0, (int) ($workspaceLeadTime['minutes'] ?? 120))
            : max(0, (int) ($branchLeadTime['minutes'] ?? $workspaceLeadTime['minutes'] ?? 120)),
        'cleanupBufferMinutes' => $useWorkspaceCleanup
            ? max(0, (int) ($workspaceCleanup['minutes'] ?? 0))
            : max(0, (int) ($branchCleanup['minutes'] ?? $workspaceCleanup['minutes'] ?? 0)),
        'useWorkspaceCancellationWindow' => $useWorkspaceCancellation,
        'useWorkspaceLeadTime' => $useWorkspaceLeadTime,
        'useWorkspaceCleanupBuffer' => $useWorkspaceCleanup,
    ];
}

function operation_policy_payload(PDO $pdo, string $tenantId): array
{
    $attendance = workspace_policy_json(
        $pdo,
        $tenantId,
        'manager.attendanceCorrections',
        ['enabled' => true]
    );
    $suspension = workspace_policy_json(
        $pdo,
        $tenantId,
        'manager.staffSuspension',
        ['enabled' => true]
    );
    $sensitiveAudits = workspace_policy_json(
        $pdo,
        $tenantId,
        'audit.sensitiveActions',
        [
            'inventoryAdjustments' => false,
            'attendanceCorrections' => false,
            'appointmentStatusChanges' => false,
            'employeeStatusChanges' => false,
        ]
    );
    $booking = booking_policy_payload($pdo, $tenantId);

    return [
        'managerCanCorrectAttendance' => !empty($attendance['enabled']),
        'managerCanSuspendStaff' => !empty($suspension['enabled']),
        'bookingCancellationWindowHours' => (int) $booking['bookingCancellationWindowHours'],
        'bookingLeadTimeMinutes' => (int) $booking['bookingLeadTimeMinutes'],
        'cleanupBufferMinutes' => (int) $booking['cleanupBufferMinutes'],
        'sensitiveInventoryAdjustments' => !empty($sensitiveAudits['inventoryAdjustments']),
        'sensitiveAttendanceCorrections' => !empty($sensitiveAudits['attendanceCorrections']),
        'sensitiveAppointmentStatusChanges' => !empty($sensitiveAudits['appointmentStatusChanges']),
        'sensitiveEmployeeStatusChanges' => !empty($sensitiveAudits['employeeStatusChanges']),
    ];
}

function policy_acknowledgement_payload(PDO $pdo, string $tenantId, ?array $authUser = null): array
{
    $policy = workspace_policy_json(
        $pdo,
        $tenantId,
        'policy.acknowledgement',
        [
            'enabled' => false,
            'version' => 'v1',
            'title' => 'Workspace handbook acknowledgement',
            'body' => 'Please review and acknowledge the latest workspace operating rules.',
            'requiredRoles' => ['manager', 'receptionist', 'employee'],
        ]
    );

    $requiredRoles = array_values(array_filter(
        array_map(static fn ($value): string => strtolower(trim((string) $value)), (array) ($policy['requiredRoles'] ?? [])),
        static fn (string $role): bool => in_array($role, ['manager', 'receptionist', 'employee'], true)
    ));
    if (!$requiredRoles) {
        $requiredRoles = ['manager', 'receptionist', 'employee'];
    }

    $acknowledged = false;
    $acknowledgedAt = null;
    if ($authUser && !empty($authUser['userId'])) {
        $statement = $pdo->prepare(
            'SELECT createdAt
             FROM AuditLog
             WHERE tenantId = :tenantId
               AND actorUserId = :actorUserId
               AND actionKey = :actionKey
               AND entityType = :entityType
               AND entityId = :entityId
             ORDER BY createdAt DESC
             LIMIT 1'
        );
        $statement->execute([
            'tenantId' => $tenantId,
            'actorUserId' => $authUser['userId'],
            'actionKey' => 'policy.acknowledged',
            'entityType' => 'WorkspacePolicyAcknowledgement',
            'entityId' => (string) ($policy['version'] ?? 'v1'),
        ]);
        $row = db_one($statement);
        $acknowledged = $row !== null;
        $acknowledgedAt = $row['createdAt'] ?? null;
    }

    return [
        'enabled' => !empty($policy['enabled']),
        'version' => (string) ($policy['version'] ?? 'v1'),
        'title' => (string) ($policy['title'] ?? 'Workspace handbook acknowledgement'),
        'body' => (string) ($policy['body'] ?? ''),
        'requiredRoles' => $requiredRoles,
        'acknowledged' => $acknowledged,
        'acknowledgedAt' => $acknowledgedAt,
    ];
}

function emit_sensitive_action_audit_if_enabled(
    PDO $pdo,
    string $tenantId,
    ?string $branchId,
    string $actorUserId,
    string $policyKey,
    string $entityType,
    string $entityId,
    array $metadata
): void {
    $policy = workspace_policy_json(
        $pdo,
        $tenantId,
        'audit.sensitiveActions',
        [
            'inventoryAdjustments' => false,
            'attendanceCorrections' => false,
            'appointmentStatusChanges' => false,
            'employeeStatusChanges' => false,
        ]
    );

    if (empty($policy[$policyKey])) {
        return;
    }

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $tenantId,
        'branchId' => $branchId,
        'actorUserId' => $actorUserId,
        'actionKey' => 'policy.sensitive_action_triggered',
        'entityType' => $entityType,
        'entityId' => $entityId,
        'metadataJson' => json_encode(array_merge($metadata, ['policyKey' => $policyKey]), JSON_UNESCAPED_SLASHES),
        'createdAt' => now_string(),
    ]);
}

function attendance_worked_minutes(array $record): int
{
    $checkInAt = $record['checkInAt'] ?? null;
    $checkOutAt = $record['checkOutAt'] ?? null;

    if (!$checkInAt || !$checkOutAt) {
        return 0;
    }

    try {
        $start = new DateTimeImmutable((string) $checkInAt, new DateTimeZone('UTC'));
        $end = new DateTimeImmutable((string) $checkOutAt, new DateTimeZone('UTC'));
    } catch (Throwable) {
        return 0;
    }

    $seconds = $end->getTimestamp() - $start->getTimestamp();
    if ($seconds <= 0) {
        return 0;
    }

    return (int) floor($seconds / 60);
}

function attendance_payroll_payload(array $summary): array
{
    return [
        'employeeId' => $summary['employeeId'],
        'employeeEmail' => $summary['employeeEmail'] ?? null,
        'employeeCode' => $summary['employeeCode'] ?? null,
        'branchId' => $summary['branchId'],
        'totalSessions' => (int) $summary['totalSessions'],
        'completedSessions' => (int) $summary['completedSessions'],
        'openSessions' => (int) $summary['openSessions'],
        'totalWorkedMinutes' => (int) $summary['totalWorkedMinutes'],
        'totalWorkedHours' => number_format(((int) $summary['totalWorkedMinutes']) / 60, 2, '.', ''),
        'totalLatenessMinutes' => (int) $summary['totalLatenessMinutes'],
        'lateSessions' => (int) $summary['lateSessions'],
        'absentSessions' => (int) $summary['absentSessions'],
        'flaggedSessions' => (int) $summary['flaggedSessions'],
        'exceptionCount' => (int) $summary['exceptionCount'],
    ];
}

function attendance_correction_payload(array $row): array
{
    $metadata = [];
    if (isset($row['metadataJson'])) {
        if (is_string($row['metadataJson'])) {
            $decoded = json_decode($row['metadataJson'], true);
            if (is_array($decoded)) {
                $metadata = $decoded;
            }
        } elseif (is_array($row['metadataJson'])) {
            $metadata = $row['metadataJson'];
        }
    }

    return [
        'id' => $row['id'],
        'attendanceId' => $row['attendanceId'],
        'branchId' => $row['branchId'] ?? null,
        'employeeId' => $row['employeeId'] ?? null,
        'employeeEmail' => $row['employeeEmail'] ?? null,
        'employeeCode' => $row['employeeCode'] ?? null,
        'actorUserId' => $row['actorUserId'],
        'actorEmail' => $row['actorEmail'] ?? null,
        'fromStatus' => $metadata['fromStatus'] ?? null,
        'toStatus' => $metadata['toStatus'] ?? null,
        'fromLatenessMinutes' => (int) ($metadata['fromLatenessMinutes'] ?? 0),
        'toLatenessMinutes' => (int) ($metadata['toLatenessMinutes'] ?? 0),
        'fromExceptionFlag' => (bool) ($metadata['fromExceptionFlag'] ?? false),
        'toExceptionFlag' => (bool) ($metadata['toExceptionFlag'] ?? false),
        'note' => isset($metadata['note']) && $metadata['note'] !== '' ? (string) $metadata['note'] : null,
        'createdAt' => $row['createdAt'],
    ];
}

function attendance_payroll_rows(
    PDO $pdo,
    string $tenantId,
    ?string $branchId,
    string $rangeStart,
    string $rangeEnd
): array {
    $sql = 'SELECT ar.id, ar.branchId, ar.employeeId, u.email AS employeeEmail, ep.employeeCode,
                   ar.attendanceStatus, ar.latenessMinutes, ar.exceptionFlag, ar.checkInAt, ar.checkOutAt, ar.createdAt
            FROM AttendanceRecord ar
            INNER JOIN EmployeeProfile ep ON ep.id = ar.employeeId
            INNER JOIN User u ON u.id = ep.userId
            WHERE ar.tenantId = :tenantId
              AND COALESCE(ar.checkInAt, ar.createdAt) >= :rangeStart
              AND COALESCE(ar.checkInAt, ar.createdAt) < :rangeEnd';
    $params = [
        'tenantId' => $tenantId,
        'rangeStart' => $rangeStart,
        'rangeEnd' => $rangeEnd,
    ];

    if ($branchId) {
        $sql .= ' AND ar.branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    $sql .= ' ORDER BY ep.employeeCode ASC, ar.createdAt ASC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    return $statement->fetchAll();
}

function attendance_payroll_summary_collection(array $rows): array
{
    $grouped = [];
    foreach ($rows as $row) {
        $key = $row['employeeId'];
        if (!isset($grouped[$key])) {
            $grouped[$key] = [
                'employeeId' => $row['employeeId'],
                'employeeEmail' => $row['employeeEmail'] ?? null,
                'employeeCode' => $row['employeeCode'] ?? null,
                'branchId' => $row['branchId'],
                'totalSessions' => 0,
                'completedSessions' => 0,
                'openSessions' => 0,
                'totalWorkedMinutes' => 0,
                'totalLatenessMinutes' => 0,
                'lateSessions' => 0,
                'absentSessions' => 0,
                'flaggedSessions' => 0,
                'exceptionCount' => 0,
            ];
        }

        $grouped[$key]['totalSessions']++;
        $grouped[$key]['totalWorkedMinutes'] += attendance_worked_minutes($row);
        $grouped[$key]['totalLatenessMinutes'] += (int) $row['latenessMinutes'];

        if ($row['checkOutAt']) {
            $grouped[$key]['completedSessions']++;
        } else {
            $grouped[$key]['openSessions']++;
        }

        if ($row['attendanceStatus'] === 'late') {
            $grouped[$key]['lateSessions']++;
        }
        if ($row['attendanceStatus'] === 'absent') {
            $grouped[$key]['absentSessions']++;
        }
        if ($row['attendanceStatus'] === 'flagged') {
            $grouped[$key]['flaggedSessions']++;
        }
        if (!empty($row['exceptionFlag'])) {
            $grouped[$key]['exceptionCount']++;
        }
    }

    $payload = array_values(array_map('attendance_payroll_payload', $grouped));
    usort($payload, static function (array $left, array $right): int {
        return strcmp((string) ($left['employeeCode'] ?? $left['employeeEmail'] ?? ''), (string) ($right['employeeCode'] ?? $right['employeeEmail'] ?? ''));
    });

    return $payload;
}

function attendance_payroll_snapshot_payload(array $row): array
{
    $metadata = [];
    if (isset($row['metadataJson'])) {
        if (is_string($row['metadataJson'])) {
            $decoded = json_decode($row['metadataJson'], true);
            if (is_array($decoded)) {
                $metadata = $decoded;
            }
        } elseif (is_array($row['metadataJson'])) {
            $metadata = $row['metadataJson'];
        }
    }

    $totalWorkedMinutes = (int) ($metadata['totalWorkedMinutes'] ?? 0);

    return [
        'id' => $row['id'],
        'branchId' => $row['branchId'] ?? null,
        'actorUserId' => $row['actorUserId'],
        'actorEmail' => $row['actorEmail'] ?? null,
        'fromDate' => (string) ($metadata['fromDate'] ?? ''),
        'toDate' => (string) ($metadata['toDate'] ?? ''),
        'employeeCount' => (int) ($metadata['employeeCount'] ?? 0),
        'totalWorkedMinutes' => $totalWorkedMinutes,
        'totalWorkedHours' => number_format($totalWorkedMinutes / 60, 2, '.', ''),
        'totalLatenessMinutes' => (int) ($metadata['totalLatenessMinutes'] ?? 0),
        'totalExceptions' => (int) ($metadata['totalExceptions'] ?? 0),
        'note' => isset($metadata['note']) && $metadata['note'] !== '' ? (string) $metadata['note'] : null,
        'createdAt' => $row['createdAt'],
    ];
}

function shift_template_payload(array $row): array
{
    return [
        'id' => $row['id'],
        'branchId' => $row['branchId'],
        'name' => $row['name'],
        'code' => $row['code'],
        'startTime' => $row['startTime'],
        'endTime' => $row['endTime'],
        'gracePeriodMinutes' => (int) $row['gracePeriodMinutes'],
        'createdAt' => $row['createdAt'],
    ];
}

function shift_assignment_payload(array $row): array
{
    return [
        'id' => $row['id'],
        'branchId' => $row['branchId'],
        'employeeId' => $row['employeeId'],
        'employeeEmail' => $row['employeeEmail'] ?? null,
        'employeeCode' => $row['employeeCode'] ?? null,
        'shiftTemplateId' => $row['shiftTemplateId'],
        'shiftTemplateName' => $row['shiftTemplateName'],
        'shiftTemplateCode' => $row['shiftTemplateCode'],
        'shiftDate' => $row['shiftDate'],
        'startAt' => $row['startAt'],
        'endAt' => $row['endAt'],
        'gracePeriodMinutes' => (int) $row['gracePeriodMinutes'],
        'createdAt' => $row['createdAt'],
    ];
}

function parse_shift_time_or_fail(string $value): string
{
    if (!preg_match('/^\d{2}:\d{2}$/', $value)) {
        error_response('Shift time must use HH:MM format');
    }

    return $value;
}

function build_shift_bounds(string $shiftDate, string $startTime, string $endTime): array
{
    $startAt = new DateTimeImmutable($shiftDate . ' ' . $startTime . ':00', new DateTimeZone('UTC'));
    $endAt = new DateTimeImmutable($shiftDate . ' ' . $endTime . ':00', new DateTimeZone('UTC'));
    if ($endAt <= $startAt) {
        $endAt = $endAt->modify('+1 day');
    }

    return [
        'startAt' => format_datetime($startAt),
        'endAt' => format_datetime($endAt),
    ];
}

function shift_assignment_for_employee_date(
    PDO $pdo,
    string $tenantId,
    string $branchId,
    string $employeeId,
    string $shiftDate
): ?array {
    $statement = $pdo->prepare(
        'SELECT sa.id, sa.branchId, sa.employeeId, u.email AS employeeEmail, ep.employeeCode,
                sa.shiftTemplateId, st.name AS shiftTemplateName, st.code AS shiftTemplateCode,
                sa.shiftDate, sa.startAt, sa.endAt, st.gracePeriodMinutes, sa.createdAt
         FROM ShiftAssignment sa
         INNER JOIN ShiftTemplate st ON st.id = sa.shiftTemplateId
         INNER JOIN EmployeeProfile ep ON ep.id = sa.employeeId
         INNER JOIN User u ON u.id = ep.userId
         WHERE sa.tenantId = :tenantId
           AND sa.branchId = :branchId
           AND sa.employeeId = :employeeId
           AND sa.shiftDate = :shiftDate
         ORDER BY sa.createdAt DESC
         LIMIT 1'
    );
    $statement->execute([
        'tenantId' => $tenantId,
        'branchId' => $branchId,
        'employeeId' => $employeeId,
        'shiftDate' => $shiftDate,
    ]);

    return db_one($statement);
}

function validate_attendance_network(
    PDO $pdo,
    array $authUser,
    string $networkIdentifier,
    string $actionKey
): void {
    if (empty($authUser['branchId'])) {
        error_response('Employee branch context is required for attendance', 409, 'conflict');
    }

    $branchStatement = $pdo->prepare(
        'SELECT id, approvedNetworks
         FROM Branch
         WHERE id = :id AND tenantId = :tenantId
         LIMIT 1'
    );
    $branchStatement->execute([
        'id' => $authUser['branchId'],
        'tenantId' => $authUser['tenantId'],
    ]);
    $branch = db_one($branchStatement);

    if (!$branch) {
        error_response('Branch not found in the active workspace', 404, 'not_found');
    }

    $approvedNetworks = approved_networks_from_branch($branch['approvedNetworks'] ?? null);
    if (!$approvedNetworks) {
        return;
    }

    if ($networkIdentifier === '') {
        error_response('Approved network identifier is required for this branch', 403, 'network_not_allowed');
    }

    if (!in_array($networkIdentifier, $approvedNetworks, true)) {
        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'branchId' => $authUser['branchId'],
            'actorUserId' => $authUser['userId'],
            'actionKey' => $actionKey,
            'entityType' => 'AttendanceRecord',
            'entityId' => $authUser['employeeId'],
            'metadataJson' => json_encode([
                'networkIdentifier' => $networkIdentifier,
                'approvedNetworks' => $approvedNetworks,
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => now_string(),
        ]);

        error_response('The device is not connected to an approved branch network', 403, 'network_not_allowed');
    }
}

if ($method === 'GET' && $path === '/api/v1/health') {
    json_response(['status' => 'ok']);
}

if ($method === 'GET' && $path === '/api/v1/public/workspaces') {
    $statement = $pdo->query(
        'SELECT id, name, slug, timezone, currency
         FROM Tenant
         WHERE status IN (\'trial\', \'active\', \'past_due\', \'grace_period\')
         ORDER BY name ASC'
    );
    json_response(array_map(static function (array $tenant): array {
        return [
            'id' => $tenant['id'],
            'name' => $tenant['name'],
            'slug' => $tenant['slug'],
            'timezone' => $tenant['timezone'],
            'currency' => $tenant['currency'],
        ];
    }, $statement->fetchAll()));
}

if ($method === 'GET' && $path === '/api/v1/public/catalog') {
    $tenantSlug = trim((string) (query_value('tenantSlug') ?? ''));
    if ($tenantSlug === '') {
        error_response('Tenant slug is required');
    }

    $tenant = load_public_tenant($pdo, $tenantSlug);

    $branchStatement = $pdo->prepare(
        'SELECT id, name, code, timezone, city, phone, email
         FROM Branch
         WHERE tenantId = :tenantId
           AND status = :status
         ORDER BY isDefault DESC, createdAt ASC'
    );
    $branchStatement->execute([
        'tenantId' => $tenant['id'],
        'status' => 'active',
    ]);
    $branches = $branchStatement->fetchAll();

    $roomStatement = $pdo->prepare(
        'SELECT id, branchId, name, code, roomType
         FROM Room
         WHERE tenantId = :tenantId
           AND status = :status
         ORDER BY createdAt ASC'
    );
    $roomStatement->execute([
        'tenantId' => $tenant['id'],
        'status' => 'active',
    ]);
    $rooms = $roomStatement->fetchAll();

    $serviceStatement = $pdo->prepare(
        'SELECT id, branchId, name, code, description, durationMinutes, price, requiresRoom
         FROM Service
         WHERE tenantId = :tenantId
           AND status = :status
         ORDER BY createdAt ASC'
    );
    $serviceStatement->execute([
        'tenantId' => $tenant['id'],
        'status' => 'active',
    ]);
    $services = $serviceStatement->fetchAll();

    json_response([
        'tenant' => [
            'id' => $tenant['id'],
            'name' => $tenant['name'],
            'slug' => $tenant['slug'],
            'timezone' => $tenant['timezone'],
            'currency' => $tenant['currency'],
        ],
        'branches' => array_map(static function (array $branch) use ($rooms, $services): array {
            return [
                'id' => $branch['id'],
                'name' => $branch['name'],
                'code' => $branch['code'],
                'timezone' => $branch['timezone'],
                'city' => $branch['city'] ?? null,
                'phone' => $branch['phone'] ?? null,
                'email' => $branch['email'] ?? null,
                'rooms' => array_values(array_map(static function (array $room): array {
                    return [
                        'id' => $room['id'],
                        'name' => $room['name'],
                        'code' => $room['code'],
                        'roomType' => $room['roomType'] ?? null,
                    ];
                }, array_filter($rooms, static fn (array $room): bool => $room['branchId'] === $branch['id']))),
                'services' => array_values(array_map(static function (array $service): array {
                    return [
                        'id' => $service['id'],
                        'name' => $service['name'],
                        'code' => $service['code'],
                        'description' => $service['description'] ?? null,
                        'durationMinutes' => (int) $service['durationMinutes'],
                        'price' => (string) $service['price'],
                        'requiresRoom' => (bool) $service['requiresRoom'],
                    ];
                }, array_filter($services, static fn (array $service): bool => $service['branchId'] === $branch['id']))),
            ];
        }, $branches),
    ]);
}

if ($method === 'GET' && $path === '/api/v1/public/bookings') {
    $tenantSlug = trim((string) (query_value('tenantSlug') ?? ''));
    $phone = trim((string) (query_value('phone') ?? ''));
    $email = strtolower(trim((string) (query_value('email') ?? '')));

    if ($tenantSlug === '' || ($phone === '' && $email === '')) {
        error_response('Tenant slug and a phone number or email are required');
    }

    $tenant = load_public_tenant($pdo, $tenantSlug);

    $sql = 'SELECT a.id, a.branchId, b.name AS branchName, a.customerId, c.fullName AS customerName, c.phone AS customerPhone,
                   a.roomId, r.name AS roomName, a.employeeId, u.email AS employeeEmail, ep.employeeCode,
                   a.status, a.source, a.notes, a.startAt, a.endAt, a.checkInAt, a.checkOutAt, a.createdAt
            FROM Appointment a
            INNER JOIN Branch b ON b.id = a.branchId
            INNER JOIN CustomerProfile c ON c.id = a.customerId
            LEFT JOIN Room r ON r.id = a.roomId
            LEFT JOIN EmployeeProfile ep ON ep.id = a.employeeId
            LEFT JOIN User u ON u.id = ep.userId
            WHERE a.tenantId = :tenantId';
    $params = ['tenantId' => $tenant['id']];

    if ($email !== '' && $phone !== '') {
        $sql .= ' AND (LOWER(c.email) = :email OR c.phone = :phone)';
        $params['email'] = $email;
        $params['phone'] = $phone;
    } elseif ($email !== '') {
        $sql .= ' AND LOWER(c.email) = :email';
        $params['email'] = $email;
    } else {
        $sql .= ' AND c.phone = :phone';
        $params['phone'] = $phone;
    }

    $sql .= ' ORDER BY a.startAt DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $appointments = $statement->fetchAll();

    $linesByAppointmentId = [];
    if ($appointments) {
        $appointmentIds = array_values(array_map(static fn (array $row): string => $row['id'], $appointments));
        $placeholders = [];
        $lineParams = [];

        foreach ($appointmentIds as $index => $appointmentId) {
            $key = 'appointmentId' . $index;
            $placeholders[] = ':' . $key;
            $lineParams[$key] = $appointmentId;
        }

        $lineStatement = $pdo->prepare(
            'SELECT al.id, al.appointmentId, al.serviceId, s.name AS serviceName, s.code AS serviceCode,
                    al.durationMinutes, al.unitPrice, al.status
             FROM AppointmentLine al
             INNER JOIN Service s ON s.id = al.serviceId
             WHERE al.appointmentId IN (' . implode(', ', $placeholders) . ')
             ORDER BY al.createdAt ASC'
        );
        $lineStatement->execute($lineParams);
        foreach ($lineStatement->fetchAll() as $line) {
            $linesByAppointmentId[$line['appointmentId']][] = [
                'id' => $line['id'],
                'serviceId' => $line['serviceId'],
                'serviceName' => $line['serviceName'],
                'serviceCode' => $line['serviceCode'],
                'durationMinutes' => (int) $line['durationMinutes'],
                'unitPrice' => (string) $line['unitPrice'],
                'status' => $line['status'],
            ];
        }
    }

    json_response(array_map(static function (array $row) use ($linesByAppointmentId): array {
        return [
            'id' => $row['id'],
            'branchId' => $row['branchId'],
            'branchName' => $row['branchName'],
            'customerId' => $row['customerId'],
            'customerName' => $row['customerName'],
            'customerPhone' => $row['customerPhone'],
            'roomId' => $row['roomId'],
            'roomName' => $row['roomName'],
            'employeeId' => $row['employeeId'],
            'employeeEmail' => $row['employeeEmail'],
            'employeeCode' => $row['employeeCode'],
            'status' => $row['status'],
            'source' => $row['source'],
            'notes' => $row['notes'],
            'startAt' => $row['startAt'],
            'endAt' => $row['endAt'],
            'checkInAt' => $row['checkInAt'],
            'checkOutAt' => $row['checkOutAt'],
            'createdAt' => $row['createdAt'],
            'lines' => $linesByAppointmentId[$row['id']] ?? [],
        ];
    }, $appointments));
}

if ($method === 'POST' && $path === '/api/v1/public/bookings') {
    $payload = json_input();
    $tenantSlug = trim((string) ($payload['tenantSlug'] ?? ''));
    $branchId = trim((string) ($payload['branchId'] ?? ''));
    $serviceId = trim((string) ($payload['serviceId'] ?? ''));
    $roomId = trim((string) ($payload['roomId'] ?? ''));
    $fullName = trim((string) ($payload['fullName'] ?? ''));
    $phone = trim((string) ($payload['phone'] ?? ''));
    $email = strtolower(trim((string) ($payload['email'] ?? '')));
    $startAtInput = trim((string) ($payload['startAt'] ?? ''));
    $notes = trim((string) ($payload['notes'] ?? ''));

    if (
        $tenantSlug === '' ||
        $branchId === '' ||
        $serviceId === '' ||
        $fullName === '' ||
        $startAtInput === '' ||
        ($phone === '' && $email === '')
    ) {
        error_response('Tenant, branch, service, customer name, contact, and start time are required');
    }

    $tenant = load_public_tenant($pdo, $tenantSlug);

    $branchStatement = $pdo->prepare(
        'SELECT id, name
         FROM Branch
         WHERE id = :id
           AND tenantId = :tenantId
           AND status = :status
         LIMIT 1'
    );
    $branchStatement->execute([
        'id' => $branchId,
        'tenantId' => $tenant['id'],
        'status' => 'active',
    ]);
    $branch = db_one($branchStatement);
    if (!$branch) {
        error_response('Branch is not available for booking');
    }

    $bookingPolicy = booking_policy_payload($pdo, $tenant['id'], $branchId);

    $serviceStatement = $pdo->prepare(
        'SELECT id, name, code, durationMinutes, price, requiresRoom
         FROM Service
         WHERE id = :id
           AND tenantId = :tenantId
           AND branchId = :branchId
           AND status = :status
         LIMIT 1'
    );
    $serviceStatement->execute([
        'id' => $serviceId,
        'tenantId' => $tenant['id'],
        'branchId' => $branchId,
        'status' => 'active',
    ]);
    $service = db_one($serviceStatement);
    if (!$service) {
        error_response('Service is not available in the selected branch');
    }

    $room = null;
    if ($roomId !== '') {
        $roomStatement = $pdo->prepare(
            'SELECT id, name, cleanupBufferMinutes
             FROM Room
             WHERE id = :id
               AND tenantId = :tenantId
               AND branchId = :branchId
               AND status = :status
             LIMIT 1'
        );
        $roomStatement->execute([
            'id' => $roomId,
            'tenantId' => $tenant['id'],
            'branchId' => $branchId,
            'status' => 'active',
        ]);
        $room = db_one($roomStatement);
        if (!$room) {
            error_response('Room is not available in the selected branch');
        }
    }

    if ((bool) $service['requiresRoom'] && !$room) {
        error_response('This service requires a room selection');
    }

    $startAt = new DateTimeImmutable(iso_datetime_string($startAtInput), new DateTimeZone('UTC'));
    $endAt = $startAt->modify('+' . (int) $service['durationMinutes'] . ' minutes');
    assert_booking_lead_time($startAt, (int) $bookingPolicy['bookingLeadTimeMinutes']);

    if ($room) {
        assert_room_available_for_appointment(
            $pdo,
            $tenant['id'],
            $room,
            format_datetime($startAt),
            format_datetime($endAt),
            (int) $bookingPolicy['cleanupBufferMinutes']
        );
    }

    $customerLookupSql = 'SELECT id, userId, fullName, phone, email
                          FROM CustomerProfile
                          WHERE tenantId = :tenantId';
    $customerLookupParams = ['tenantId' => $tenant['id']];
    if ($email !== '') {
        $customerLookupSql .= ' AND LOWER(email) = :email';
        $customerLookupParams['email'] = $email;
    } else {
        $customerLookupSql .= ' AND phone = :phone';
        $customerLookupParams['phone'] = $phone;
    }
    $customerLookupSql .= ' ORDER BY createdAt ASC LIMIT 1';
    $customerLookup = $pdo->prepare($customerLookupSql);
    $customerLookup->execute($customerLookupParams);
    $customer = db_one($customerLookup);

    $customerId = $customer['id'] ?? app_id();
    $appointmentId = app_id();
    $lineId = app_id();
    $now = now_string();

    $pdo->beginTransaction();
    try {
        if (!$customer) {
            $linkedUserId = null;
            if ($email !== '') {
                $userLookup = $pdo->prepare(
                    'SELECT id
                     FROM User
                     WHERE email = :email
                       AND status = :status
                     LIMIT 1'
                );
                $userLookup->execute([
                    'email' => $email,
                    'status' => 'active',
                ]);
                $existingUser = db_one($userLookup);
                $linkedUserId = $existingUser['id'] ?? null;
            }

            $customerInsert = $pdo->prepare(
                'INSERT INTO CustomerProfile
                 (id, tenantId, userId, primaryBranchId, fullName, phone, email, marketingConsent, createdAt, updatedAt)
                 VALUES (:id, :tenantId, :userId, :primaryBranchId, :fullName, :phone, :email, :marketingConsent, :createdAt, :updatedAt)'
            );
            $customerInsert->execute([
                'id' => $customerId,
                'tenantId' => $tenant['id'],
                'userId' => $linkedUserId,
                'primaryBranchId' => $branchId,
                'fullName' => $fullName,
                'phone' => $phone !== '' ? $phone : null,
                'email' => $email !== '' ? $email : null,
                'marketingConsent' => 0,
                'createdAt' => $now,
                'updatedAt' => $now,
            ]);
            $customer = [
                'id' => $customerId,
                'userId' => $linkedUserId,
                'fullName' => $fullName,
                'phone' => $phone !== '' ? $phone : null,
                'email' => $email !== '' ? $email : null,
            ];
        }

        $appointmentInsert = $pdo->prepare(
            'INSERT INTO Appointment
             (id, tenantId, branchId, customerId, roomId, employeeId, status, source, notes, startAt, endAt, createdAt, updatedAt)
             VALUES (:id, :tenantId, :branchId, :customerId, :roomId, NULL, :status, :source, :notes, :startAt, :endAt, :createdAt, :updatedAt)'
        );
        $appointmentInsert->execute([
            'id' => $appointmentId,
            'tenantId' => $tenant['id'],
            'branchId' => $branchId,
            'customerId' => $customerId,
            'roomId' => $room['id'] ?? null,
            'status' => 'confirmed',
            'source' => 'customer_app',
            'notes' => $notes !== '' ? $notes : null,
            'startAt' => format_datetime($startAt),
            'endAt' => format_datetime($endAt),
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $lineInsert = $pdo->prepare(
            'INSERT INTO AppointmentLine
             (id, tenantId, appointmentId, serviceId, employeeId, durationMinutes, unitPrice, status, createdAt, updatedAt)
             VALUES (:id, :tenantId, :appointmentId, :serviceId, NULL, :durationMinutes, :unitPrice, :status, :createdAt, :updatedAt)'
        );
        $lineInsert->execute([
            'id' => $lineId,
            'tenantId' => $tenant['id'],
            'appointmentId' => $appointmentId,
            'serviceId' => $service['id'],
            'durationMinutes' => (int) $service['durationMinutes'],
            'unitPrice' => (string) $service['price'],
            'status' => 'confirmed',
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $tenant['id'],
            'branchId' => $branchId,
            'actorUserId' => $tenant['ownerUserId'],
            'actionKey' => 'public.booking_created',
            'entityType' => 'Appointment',
            'entityId' => $appointmentId,
            'metadataJson' => json_encode([
                'customerName' => $fullName,
                'customerPhone' => $phone !== '' ? $phone : null,
                'customerEmail' => $email !== '' ? $email : null,
                'serviceCode' => $service['code'],
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);

        notify_workspace_roles(
            $pdo,
            $tenant['id'],
            $branchId,
            ['owner', 'manager', 'receptionist'],
            'appointment_created',
            'New customer booking',
            sprintf('A customer booking was created for %s in %s.', $service['name'], $branch['name']),
            'Appointment',
            $appointmentId
        );

        if (!empty($customer['userId'])) {
            create_notification(
                $pdo,
                $tenant['id'],
                $branchId,
                $customer['userId'],
                'booking_confirmed',
                'Booking confirmed',
                sprintf('Your booking for %s in %s was created successfully.', $service['name'], $branch['name']),
                'Appointment',
                $appointmentId
            );
        }

        $pdo->commit();
    } catch (Throwable $issue) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $issue;
    }

    $appointment = load_appointment_summary($pdo, $tenant['id'], $appointmentId);
    if (!$appointment) {
        error_response('Booking was created but could not be loaded', 500, 'server_error');
    }

    json_response($appointment, 201);
}

if ($method === 'GET' && $path === '/api/v1/notifications') {
    $authUser = require_workspace_roles(
        authenticated_user(),
        ['owner', 'manager', 'receptionist', 'employee', 'customer'],
        'Workspace notification access is required'
    );
    require_enabled_module($pdo, $authUser['tenantId'], 'notifications', 'Notifications are disabled for this workspace');

    $statement = $pdo->prepare(
        'SELECT id, tenantId, branchId, userId, type, title, body, status, referenceType, referenceId, createdAt
         FROM Notification
         WHERE tenantId = :tenantId
           AND userId = :userId
         ORDER BY createdAt DESC
         LIMIT 100'
    );
    $statement->execute([
        'tenantId' => $authUser['tenantId'],
        'userId' => $authUser['userId'],
    ]);

    json_response(array_map(static function (array $row): array {
        return [
            'id' => $row['id'],
            'tenantId' => $row['tenantId'],
            'branchId' => $row['branchId'] ?? null,
            'userId' => $row['userId'],
            'type' => $row['type'],
            'title' => $row['title'],
            'body' => $row['body'],
            'status' => $row['status'],
            'referenceType' => $row['referenceType'] ?? null,
            'referenceId' => $row['referenceId'] ?? null,
            'createdAt' => $row['createdAt'],
        ];
    }, $statement->fetchAll()));
}

if ($method === 'GET' && $path === '/api/v1/policies/acknowledgement/current') {
    $authUser = require_workspace_roles(
        authenticated_user(),
        ['owner', 'manager', 'receptionist', 'employee'],
        'Workspace policy access is required'
    );
    json_response(policy_acknowledgement_payload($pdo, $authUser['tenantId'], $authUser));
}

if ($method === 'POST' && $path === '/api/v1/policies/acknowledgement/acknowledge') {
    $authUser = require_workspace_roles(
        authenticated_user(),
        ['owner', 'manager', 'receptionist', 'employee'],
        'Workspace policy access is required'
    );
    $policy = policy_acknowledgement_payload($pdo, $authUser['tenantId'], $authUser);
    if (!$policy['enabled']) {
        json_response($policy);
    }

    $role = strtolower((string) ($authUser['role'] ?? 'employee'));
    if ($role !== 'owner' && !in_array($role, $policy['requiredRoles'], true)) {
        json_response($policy);
    }

    if (!$policy['acknowledged']) {
        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'branchId' => $authUser['branchId'] ?? null,
            'actorUserId' => $authUser['userId'],
            'actionKey' => 'policy.acknowledged',
            'entityType' => 'WorkspacePolicyAcknowledgement',
            'entityId' => $policy['version'],
            'metadataJson' => json_encode([
                'role' => $role,
                'title' => $policy['title'],
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => now_string(),
        ]);
    }

    json_response(policy_acknowledgement_payload($pdo, $authUser['tenantId'], $authUser));
}

if ($method === 'GET' && $path === '/api/v1/customer/profile') {
    $authUser = require_customer_workspace(authenticated_user());
    require_enabled_module($pdo, $authUser['tenantId'], 'customerAccounts', 'Customer accounts are disabled for this workspace');

    $statement = $pdo->prepare(
        'SELECT cp.id, cp.tenantId, t.name AS tenantName, t.slug AS tenantSlug, cp.primaryBranchId,
                cp.fullName, cp.phone, cp.email, cp.dateOfBirth, cp.preferencesJson, cp.notes,
                cp.marketingConsent, cp.createdAt
         FROM CustomerProfile cp
         INNER JOIN Tenant t ON t.id = cp.tenantId
         WHERE cp.tenantId = :tenantId
           AND cp.userId = :userId
         ORDER BY cp.createdAt ASC
         LIMIT 1'
    );
    $statement->execute([
        'tenantId' => $authUser['tenantId'],
        'userId' => $authUser['userId'],
    ]);
    $profile = db_one($statement);
    if (!$profile) {
        error_response('Customer profile not found for the active workspace', 404, 'not_found');
    }

    json_response(customer_profile_payload($pdo, $profile));
}

if ($method === 'POST' && $path === '/api/v1/customer/profile') {
    $authUser = require_customer_workspace(authenticated_user());
    require_enabled_module($pdo, $authUser['tenantId'], 'customerAccounts', 'Customer accounts are disabled for this workspace');
    $payload = json_input();
    $fullName = trim((string) ($payload['fullName'] ?? ''));
    $phone = trim((string) ($payload['phone'] ?? ''));
    $dateOfBirth = trim((string) ($payload['dateOfBirth'] ?? ''));
    $preferences = $payload['preferences'] ?? null;
    $marketingConsent = !empty($payload['marketingConsent']) ? 1 : 0;

    if ($fullName === '') {
        error_response('Full name is required');
    }

    $statement = $pdo->prepare(
        'SELECT cp.id, cp.tenantId, t.name AS tenantName, t.slug AS tenantSlug, cp.primaryBranchId,
                cp.fullName, cp.phone, cp.email, cp.dateOfBirth, cp.preferencesJson, cp.notes,
                cp.marketingConsent, cp.createdAt
         FROM CustomerProfile cp
         INNER JOIN Tenant t ON t.id = cp.tenantId
         WHERE cp.tenantId = :tenantId
           AND cp.userId = :userId
         ORDER BY cp.createdAt ASC
         LIMIT 1'
    );
    $statement->execute([
        'tenantId' => $authUser['tenantId'],
        'userId' => $authUser['userId'],
    ]);
    $profile = db_one($statement);
    if (!$profile) {
        error_response('Customer profile not found for the active workspace', 404, 'not_found');
    }

    $now = now_string();
    $update = $pdo->prepare(
        'UPDATE CustomerProfile
         SET fullName = :fullName,
             phone = :phone,
             dateOfBirth = :dateOfBirth,
             preferencesJson = :preferencesJson,
             marketingConsent = :marketingConsent,
             updatedAt = :updatedAt
         WHERE id = :id'
    );
    $update->execute([
        'fullName' => $fullName,
        'phone' => $phone !== '' ? $phone : null,
        'dateOfBirth' => $dateOfBirth !== '' ? iso_date_string($dateOfBirth) : null,
        'preferencesJson' => is_array($preferences) ? json_encode($preferences, JSON_UNESCAPED_SLASHES) : null,
        'marketingConsent' => $marketingConsent,
        'updatedAt' => $now,
        'id' => $profile['id'],
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, NULL, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'customer.profile_updated',
        'entityType' => 'CustomerProfile',
        'entityId' => $profile['id'],
        'metadataJson' => json_encode([
            'marketingConsent' => (bool) $marketingConsent,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    $statement->execute([
        'tenantId' => $authUser['tenantId'],
        'userId' => $authUser['userId'],
    ]);

    json_response(customer_profile_payload($pdo, (array) db_one($statement)));
}

if ($method === 'GET' && $path === '/api/v1/customer/appointments') {
    $authUser = require_customer_workspace(authenticated_user());
    require_enabled_module($pdo, $authUser['tenantId'], 'customerAccounts', 'Customer accounts are disabled for this workspace');

    $profileStatement = $pdo->prepare(
        'SELECT id
         FROM CustomerProfile
         WHERE tenantId = :tenantId
           AND userId = :userId
         ORDER BY createdAt ASC
         LIMIT 1'
    );
    $profileStatement->execute([
        'tenantId' => $authUser['tenantId'],
        'userId' => $authUser['userId'],
    ]);
    $profile = db_one($profileStatement);
    if (!$profile) {
        error_response('Customer profile not found for the active workspace', 404, 'not_found');
    }

    $statement = $pdo->prepare(
        'SELECT a.id
         FROM Appointment a
         WHERE a.tenantId = :tenantId
           AND a.customerId = :customerId
         ORDER BY a.startAt DESC
         LIMIT 100'
    );
    $statement->execute([
        'tenantId' => $authUser['tenantId'],
        'customerId' => $profile['id'],
    ]);

    $appointments = [];
    foreach ($statement->fetchAll() as $row) {
        $summary = load_appointment_summary($pdo, $authUser['tenantId'], $row['id']);
        if ($summary) {
            $appointments[] = $summary;
        }
    }

    json_response($appointments);
}

if ($method === 'POST' && preg_match('#^/api/v1/notifications/([^/]+)/read$#', $path, $matches) === 1) {
    $authUser = require_workspace_roles(
        authenticated_user(),
        ['owner', 'manager', 'receptionist', 'employee', 'customer'],
        'Workspace notification access is required'
    );
    require_enabled_module($pdo, $authUser['tenantId'], 'notifications', 'Notifications are disabled for this workspace');
    $notificationId = trim((string) $matches[1]);

    $update = $pdo->prepare(
        'UPDATE Notification
         SET status = :status
         WHERE id = :id
           AND tenantId = :tenantId
           AND userId = :userId'
    );
    $update->execute([
        'status' => 'read',
        'id' => $notificationId,
        'tenantId' => $authUser['tenantId'],
        'userId' => $authUser['userId'],
    ]);

    $statement = $pdo->prepare(
        'SELECT id, tenantId, branchId, userId, type, title, body, status, referenceType, referenceId, createdAt
         FROM Notification
         WHERE id = :id
           AND tenantId = :tenantId
           AND userId = :userId
         LIMIT 1'
    );
    $statement->execute([
        'id' => $notificationId,
        'tenantId' => $authUser['tenantId'],
        'userId' => $authUser['userId'],
    ]);
    $notification = db_one($statement);
    if (!$notification) {
        error_response('Notification not found', 404, 'not_found');
    }

    json_response([
        'id' => $notification['id'],
        'tenantId' => $notification['tenantId'],
        'branchId' => $notification['branchId'] ?? null,
        'userId' => $notification['userId'],
        'type' => $notification['type'],
        'title' => $notification['title'],
        'body' => $notification['body'],
        'status' => $notification['status'],
        'referenceType' => $notification['referenceType'] ?? null,
        'referenceId' => $notification['referenceId'] ?? null,
        'createdAt' => $notification['createdAt'],
    ]);
}

if ($method === 'GET' && $path === '/api/v1/superadmin/dashboard') {
    require_superadmin($pdo, authenticated_user());

    $tenantCounts = $pdo->query(
        'SELECT
            COUNT(*) AS totalTenants,
            SUM(CASE WHEN status = \'active\' THEN 1 ELSE 0 END) AS activeTenants,
            SUM(CASE WHEN status = \'suspended\' THEN 1 ELSE 0 END) AS suspendedTenants,
            SUM(CASE WHEN status = \'trial\' THEN 1 ELSE 0 END) AS trialTenants
         FROM Tenant'
    )->fetch();

    $subscriptionCounts = $pdo->query(
        'SELECT COUNT(*) AS pastDueSubscriptions
         FROM Subscription
         WHERE status = \'past_due\''
    )->fetch();

    $supportCounts = $pdo->query(
        'SELECT COUNT(*) AS openSupportTickets
         FROM SupportTicket
         WHERE status IN (\'open\', \'in_progress\', \'waiting_on_customer\')'
    )->fetch();

    json_response([
        'totalTenants' => (int) ($tenantCounts['totalTenants'] ?? 0),
        'activeTenants' => (int) ($tenantCounts['activeTenants'] ?? 0),
        'suspendedTenants' => (int) ($tenantCounts['suspendedTenants'] ?? 0),
        'trialTenants' => (int) ($tenantCounts['trialTenants'] ?? 0),
        'pastDueSubscriptions' => (int) ($subscriptionCounts['pastDueSubscriptions'] ?? 0),
        'openSupportTickets' => (int) ($supportCounts['openSupportTickets'] ?? 0),
    ]);
}

if ($method === 'GET' && $path === '/api/v1/superadmin/audit') {
    require_superadmin($pdo, authenticated_user());
    $tenantId = query_value('tenantId');
    $actionKey = query_value('actionKey');
    $limit = max(1, min(200, (int) (query_value('limit') ?? '50')));

    if ($tenantId !== null) {
        $tenantStatement = $pdo->prepare('SELECT id FROM Tenant WHERE id = :id LIMIT 1');
        $tenantStatement->execute(['id' => $tenantId]);
        if (!db_one($tenantStatement)) {
            error_response('Tenant not found', 404, 'not_found');
        }
    }

    $sql = 'SELECT al.id, al.tenantId, t.name AS tenantName, al.branchId, b.name AS branchName,
                   al.actorUserId, actor.email AS actorEmail, al.actionKey, al.entityType, al.entityId,
                   al.metadataJson, al.createdAt
            FROM AuditLog al
            INNER JOIN Tenant t ON t.id = al.tenantId
            LEFT JOIN Branch b ON b.id = al.branchId
            LEFT JOIN User actor ON actor.id = al.actorUserId
            WHERE 1 = 1';
    $params = [];

    if ($tenantId !== null) {
        $sql .= ' AND al.tenantId = :tenantId';
        $params['tenantId'] = $tenantId;
    }

    if ($actionKey !== null) {
        $sql .= ' AND al.actionKey = :actionKey';
        $params['actionKey'] = $actionKey;
    }

    $sql .= ' ORDER BY al.createdAt DESC LIMIT ' . $limit;
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map(static function (array $row): array {
        $metadata = null;
        if (!empty($row['metadataJson'])) {
            $decoded = json_decode((string) $row['metadataJson'], true);
            $metadata = is_array($decoded) ? $decoded : null;
        }

        return [
            'id' => $row['id'],
            'tenantId' => $row['tenantId'],
            'tenantName' => $row['tenantName'],
            'branchId' => $row['branchId'] ?? null,
            'branchName' => $row['branchName'] ?? null,
            'actorUserId' => $row['actorUserId'],
            'actorEmail' => $row['actorEmail'] ?? null,
            'actionKey' => $row['actionKey'],
            'entityType' => $row['entityType'],
            'entityId' => $row['entityId'],
            'metadata' => $metadata,
            'createdAt' => $row['createdAt'],
        ];
    }, $statement->fetchAll()));
}

if ($method === 'GET' && $path === '/api/v1/superadmin/usage') {
    require_superadmin($pdo, authenticated_user());
    $tenantId = query_value('tenantId');

    if ($tenantId !== null) {
        $tenantStatement = $pdo->prepare('SELECT id FROM Tenant WHERE id = :id LIMIT 1');
        $tenantStatement->execute(['id' => $tenantId]);
        if (!db_one($tenantStatement)) {
            error_response('Tenant not found', 404, 'not_found');
        }
    }

    json_response(superadmin_tenant_usage_collection($pdo, $tenantId));
}

if ($method === 'POST' && $path === '/api/v1/superadmin/maintenance-announcement') {
    $superadmin = require_superadmin($pdo, authenticated_user());
    $payload = json_input();
    $title = trim((string) ($payload['title'] ?? ''));
    $body = trim((string) ($payload['body'] ?? ''));

    if ($title === '' || $body === '') {
        error_response('Announcement title and body are required');
    }

    $tenantStatement = $pdo->query(
        'SELECT id
         FROM Tenant
         WHERE status IN (\'trial\', \'active\', \'grace_period\')'
    );
    $deliveredCount = 0;
    foreach ($tenantStatement->fetchAll() as $tenant) {
        $deliveredCount += notify_workspace_roles(
            $pdo,
            $tenant['id'],
            null,
            ['owner', 'manager', 'receptionist', 'employee'],
            'maintenance_notice',
            $title,
            $body,
            'Maintenance',
            $tenant['id']
        );
        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, NULL, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $tenant['id'],
            'actorUserId' => $superadmin['userId'],
            'actionKey' => 'superadmin.maintenance_announcement_sent',
            'entityType' => 'Maintenance',
            'entityId' => app_id(),
            'metadataJson' => json_encode(['title' => $title], JSON_UNESCAPED_SLASHES),
            'createdAt' => now_string(),
        ]);
    }

    json_response(['deliveredCount' => $deliveredCount]);
}

if ($method === 'POST' && $path === '/api/v1/superadmin/trial-ending-scan') {
    $superadmin = require_superadmin($pdo, authenticated_user());
    $payload = json_input();
    $daysAhead = max(1, (int) ($payload['daysAhead'] ?? 3));
    $cutoff = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->modify('+' . $daysAhead . ' days')
        ->format('Y-m-d H:i:s.v');

    $statement = $pdo->prepare(
        'SELECT id, name, slug, trialEndsAt
         FROM Tenant
         WHERE status = \'trial\'
           AND trialEndsAt IS NOT NULL
           AND trialEndsAt <= :cutoff'
    );
    $statement->execute(['cutoff' => $cutoff]);

    $deliveredCount = 0;
    foreach ($statement->fetchAll() as $tenant) {
        $deliveredCount += notify_workspace_roles(
            $pdo,
            $tenant['id'],
            null,
            ['owner'],
            'trial_ending',
            'Trial ending soon',
            sprintf('Your workspace %s trial is ending on %s.', $tenant['name'], (string) $tenant['trialEndsAt']),
            'Tenant',
            $tenant['id']
        );
        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, NULL, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $tenant['id'],
            'actorUserId' => $superadmin['userId'],
            'actionKey' => 'superadmin.trial_ending_scan_run',
            'entityType' => 'Tenant',
            'entityId' => $tenant['id'],
            'metadataJson' => json_encode(['daysAhead' => $daysAhead], JSON_UNESCAPED_SLASHES),
            'createdAt' => now_string(),
        ]);
    }

    json_response([
        'deliveredCount' => $deliveredCount,
        'daysAhead' => $daysAhead,
    ]);
}

if ($method === 'GET' && $path === '/api/v1/superadmin/tenants') {
    require_superadmin($pdo, authenticated_user());

    $statement = $pdo->query(
        'SELECT t.id, t.name, t.slug, t.status, t.timezone, t.currency, t.country, t.trialEndsAt, t.activatedAt,
                t.suspendedAt, t.createdAt, owner.email AS ownerEmail,
                (SELECT COUNT(*) FROM Branch b WHERE b.tenantId = t.id) AS branchCount,
                (SELECT COUNT(*) FROM EmployeeProfile ep WHERE ep.tenantId = t.id AND ep.employmentStatus = \'active\') AS employeeCount,
                (SELECT COUNT(*) FROM Appointment a WHERE a.tenantId = t.id) AS appointmentCount,
                (SELECT s.planCode FROM Subscription s WHERE s.tenantId = t.id ORDER BY s.createdAt DESC LIMIT 1) AS currentPlanCode,
                (SELECT s.status FROM Subscription s WHERE s.tenantId = t.id ORDER BY s.createdAt DESC LIMIT 1) AS subscriptionStatus,
                (SELECT s.renewsAt FROM Subscription s WHERE s.tenantId = t.id ORDER BY s.createdAt DESC LIMIT 1) AS renewsAt,
                (SELECT s.graceEndsAt FROM Subscription s WHERE s.tenantId = t.id ORDER BY s.createdAt DESC LIMIT 1) AS graceEndsAt
         FROM Tenant t
         INNER JOIN User owner ON owner.id = t.ownerUserId
         ORDER BY t.createdAt DESC'
    );

    json_response(array_map(static function (array $tenant): array {
        return [
            'id' => $tenant['id'],
            'name' => $tenant['name'],
            'slug' => $tenant['slug'],
            'status' => $tenant['status'],
            'timezone' => $tenant['timezone'],
            'currency' => $tenant['currency'],
            'country' => $tenant['country'],
            'trialEndsAt' => $tenant['trialEndsAt'] ?? null,
            'activatedAt' => $tenant['activatedAt'] ?? null,
            'suspendedAt' => $tenant['suspendedAt'] ?? null,
            'branchCount' => (int) $tenant['branchCount'],
            'employeeCount' => (int) $tenant['employeeCount'],
            'appointmentCount' => (int) $tenant['appointmentCount'],
            'ownerEmail' => $tenant['ownerEmail'] ?? null,
            'currentPlanCode' => $tenant['currentPlanCode'] ?? null,
            'subscriptionStatus' => $tenant['subscriptionStatus'] ?? null,
            'renewsAt' => $tenant['renewsAt'] ?? null,
            'graceEndsAt' => $tenant['graceEndsAt'] ?? null,
            'createdAt' => $tenant['createdAt'],
        ];
    }, $statement->fetchAll()));
}

if ($method === 'GET' && preg_match('#^/api/v1/superadmin/tenants/([^/]+)$#', $path, $matches) === 1) {
    require_superadmin($pdo, authenticated_user());
    $tenantId = trim((string) $matches[1]);
    json_response(superadmin_tenant_detail_payload($pdo, $tenantId));
}

if ($method === 'POST' && preg_match('#^/api/v1/superadmin/tenants/([^/]+)/modules$#', $path, $matches) === 1) {
    $superadmin = require_superadmin($pdo, authenticated_user());
    $tenantId = trim((string) $matches[1]);
    $payload = json_input();
    $modules = [
        'inventory' => !empty($payload['inventory']),
        'employeeCredit' => !empty($payload['employeeCredit']),
        'notifications' => !empty($payload['notifications']),
        'customerAccounts' => !empty($payload['customerAccounts']),
    ];

    $tenantStatement = $pdo->prepare('SELECT id FROM Tenant WHERE id = :id LIMIT 1');
    $tenantStatement->execute(['id' => $tenantId]);
    if (!db_one($tenantStatement)) {
        error_response('Tenant not found', 404, 'not_found');
    }

    upsert_workspace_policy($pdo, $tenantId, 'tenant.modules', $modules);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, NULL, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $tenantId,
        'actorUserId' => $superadmin['userId'],
        'actionKey' => 'superadmin.tenant_modules_updated',
        'entityType' => 'WorkspacePolicy',
        'entityId' => $tenantId,
        'metadataJson' => json_encode($modules, JSON_UNESCAPED_SLASHES),
        'createdAt' => now_string(),
    ]);

    json_response(superadmin_tenant_detail_payload($pdo, $tenantId));
}

if ($method === 'POST' && preg_match('#^/api/v1/superadmin/tenants/([^/]+)/status$#', $path, $matches) === 1) {
    $superadmin = require_superadmin($pdo, authenticated_user());
    $tenantId = trim((string) $matches[1]);
    $payload = json_input();
    $status = trim((string) ($payload['status'] ?? ''));
    $note = trim((string) ($payload['note'] ?? ''));

    if (!in_array($status, ['trial', 'active', 'grace_period', 'suspended', 'archived'], true)) {
        error_response('Unsupported tenant status');
    }

    $tenantStatement = $pdo->prepare(
        'SELECT id, status
         FROM Tenant
         WHERE id = :id
         LIMIT 1'
    );
    $tenantStatement->execute(['id' => $tenantId]);
    $tenant = db_one($tenantStatement);
    if (!$tenant) {
        error_response('Tenant not found', 404, 'not_found');
    }

    $now = now_string();
    $update = $pdo->prepare(
        'UPDATE Tenant
         SET status = :status,
             activatedAt = CASE
                WHEN :status IN (\'trial\', \'active\', \'grace_period\') AND activatedAt IS NULL THEN :activatedAt
                ELSE activatedAt
             END,
             suspendedAt = CASE
                WHEN :status = \'suspended\' THEN :suspendedAt
                WHEN :status IN (\'trial\', \'active\', \'grace_period\', \'archived\') THEN NULL
                ELSE suspendedAt
             END,
             updatedAt = :updatedAt
         WHERE id = :id'
    );
    $update->execute([
        'status' => $status,
        'activatedAt' => $now,
        'suspendedAt' => $now,
        'updatedAt' => $now,
        'id' => $tenantId,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, NULL, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $tenantId,
        'actorUserId' => $superadmin['userId'],
        'actionKey' => 'superadmin.tenant_status_updated',
        'entityType' => 'Tenant',
        'entityId' => $tenantId,
        'metadataJson' => json_encode([
            'fromStatus' => $tenant['status'],
            'toStatus' => $status,
            'note' => $note !== '' ? $note : null,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    json_response(superadmin_tenant_detail_payload($pdo, $tenantId));
}

if ($method === 'POST' && preg_match('#^/api/v1/superadmin/tenants/([^/]+)/subscription$#', $path, $matches) === 1) {
    $superadmin = require_superadmin($pdo, authenticated_user());
    $tenantId = trim((string) $matches[1]);
    $payload = json_input();
    $planCode = trim((string) ($payload['planCode'] ?? ''));
    $status = trim((string) ($payload['status'] ?? 'active'));
    $renewsAt = trim((string) ($payload['renewsAt'] ?? ''));
    $graceEndsAt = trim((string) ($payload['graceEndsAt'] ?? ''));
    $note = trim((string) ($payload['note'] ?? ''));

    if ($planCode === '') {
        error_response('Plan code is required');
    }

    if (!in_array($status, ['trial', 'active', 'past_due', 'grace_period', 'suspended', 'canceled'], true)) {
        error_response('Unsupported subscription status');
    }

    $tenantStatement = $pdo->prepare('SELECT id FROM Tenant WHERE id = :id LIMIT 1');
    $tenantStatement->execute(['id' => $tenantId]);
    if (!db_one($tenantStatement)) {
        error_response('Tenant not found', 404, 'not_found');
    }

    $existingStatement = $pdo->prepare(
        'SELECT id
         FROM Subscription
         WHERE tenantId = :tenantId
         ORDER BY createdAt DESC
         LIMIT 1'
    );
    $existingStatement->execute(['tenantId' => $tenantId]);
    $existing = db_one($existingStatement);
    $now = now_string();

    if ($existing) {
        $update = $pdo->prepare(
            'UPDATE Subscription
             SET planCode = :planCode,
                 status = :status,
                 renewsAt = :renewsAt,
                 graceEndsAt = :graceEndsAt,
                 canceledAt = CASE WHEN :status = \'canceled\' THEN :canceledAt ELSE NULL END,
                 updatedAt = :updatedAt
             WHERE id = :id'
        );
        $update->execute([
            'planCode' => $planCode,
            'status' => $status,
            'renewsAt' => $renewsAt !== '' ? iso_datetime_string($renewsAt) : null,
            'graceEndsAt' => $graceEndsAt !== '' ? iso_datetime_string($graceEndsAt) : null,
            'canceledAt' => $now,
            'updatedAt' => $now,
            'id' => $existing['id'],
        ]);
        $subscriptionId = $existing['id'];
    } else {
        $subscriptionId = app_id();
        $insert = $pdo->prepare(
            'INSERT INTO Subscription
             (id, tenantId, planCode, status, startedAt, renewsAt, graceEndsAt, canceledAt, createdAt, updatedAt)
             VALUES (:id, :tenantId, :planCode, :status, :startedAt, :renewsAt, :graceEndsAt, :canceledAt, :createdAt, :updatedAt)'
        );
        $insert->execute([
            'id' => $subscriptionId,
            'tenantId' => $tenantId,
            'planCode' => $planCode,
            'status' => $status,
            'startedAt' => $now,
            'renewsAt' => $renewsAt !== '' ? iso_datetime_string($renewsAt) : null,
            'graceEndsAt' => $graceEndsAt !== '' ? iso_datetime_string($graceEndsAt) : null,
            'canceledAt' => $status === 'canceled' ? $now : null,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);
    }

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, NULL, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $tenantId,
        'actorUserId' => $superadmin['userId'],
        'actionKey' => 'superadmin.subscription_updated',
        'entityType' => 'Subscription',
        'entityId' => $subscriptionId,
        'metadataJson' => json_encode([
            'planCode' => $planCode,
            'status' => $status,
            'note' => $note !== '' ? $note : null,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    json_response(superadmin_tenant_detail_payload($pdo, $tenantId));
}

if ($method === 'POST' && preg_match('#^/api/v1/superadmin/tenants/([^/]+)/invoices$#', $path, $matches) === 1) {
    $superadmin = require_superadmin($pdo, authenticated_user());
    $tenantId = trim((string) $matches[1]);
    $payload = json_input();
    $totalAmount = (float) ($payload['totalAmount'] ?? 0);
    $status = trim((string) ($payload['status'] ?? 'issued'));
    $dueAt = trim((string) ($payload['dueAt'] ?? ''));
    $note = trim((string) ($payload['note'] ?? ''));

    if ($totalAmount <= 0) {
        error_response('Invoice total amount must be greater than zero');
    }

    if (!in_array($status, ['draft', 'issued', 'paid', 'void', 'overdue'], true)) {
        error_response('Unsupported invoice status');
    }

    $tenantStatement = $pdo->prepare('SELECT id, currency FROM Tenant WHERE id = :id LIMIT 1');
    $tenantStatement->execute(['id' => $tenantId]);
    $tenant = db_one($tenantStatement);
    if (!$tenant) {
        error_response('Tenant not found', 404, 'not_found');
    }

    $subscriptionStatement = $pdo->prepare(
        'SELECT id
         FROM Subscription
         WHERE tenantId = :tenantId
         ORDER BY createdAt DESC
         LIMIT 1'
    );
    $subscriptionStatement->execute(['tenantId' => $tenantId]);
    $subscription = db_one($subscriptionStatement);
    if (!$subscription) {
        error_response('Create or assign a subscription before invoicing this tenant');
    }

    $invoiceId = app_id();
    $now = now_string();
    $invoiceNumber = 'INV-' . gmdate('Ymd') . '-' . strtoupper(substr(app_id(), -6));
    $amount = number_format($totalAmount, 2, '.', '');

    $pdo->beginTransaction();
    try {
        $invoiceInsert = $pdo->prepare(
            'INSERT INTO Invoice
             (id, tenantId, subscriptionId, invoiceNumber, status, currency, subtotal, taxAmount, totalAmount, dueAt, issuedAt, paidAt, createdAt, updatedAt)
             VALUES (:id, :tenantId, :subscriptionId, :invoiceNumber, :status, :currency, :subtotal, :taxAmount, :totalAmount, :dueAt, :issuedAt, :paidAt, :createdAt, :updatedAt)'
        );
        $invoiceInsert->execute([
            'id' => $invoiceId,
            'tenantId' => $tenantId,
            'subscriptionId' => $subscription['id'],
            'invoiceNumber' => $invoiceNumber,
            'status' => $status,
            'currency' => $tenant['currency'],
            'subtotal' => $amount,
            'taxAmount' => number_format(0, 2, '.', ''),
            'totalAmount' => $amount,
            'dueAt' => $dueAt !== '' ? iso_datetime_string($dueAt) : null,
            'issuedAt' => in_array($status, ['issued', 'overdue', 'paid'], true) ? $now : null,
            'paidAt' => $status === 'paid' ? $now : null,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $entryGroupId = 'invoice:' . $invoiceId;
        $ledgerInsert = $pdo->prepare(
            'INSERT INTO LedgerEntry
             (id, tenantId, entryGroupId, accountCode, direction, amount, currency, referenceType, referenceId, description, createdAt)
             VALUES (:id, :tenantId, :entryGroupId, :accountCode, :direction, :amount, :currency, :referenceType, :referenceId, :description, :createdAt)'
        );
        foreach ([
            ['accountCode' => 'accounts_receivable', 'direction' => 'debit'],
            ['accountCode' => 'saas_subscription_revenue', 'direction' => 'credit'],
        ] as $entry) {
            $ledgerInsert->execute([
                'id' => app_id(),
                'tenantId' => $tenantId,
                'entryGroupId' => $entryGroupId,
                'accountCode' => $entry['accountCode'],
                'direction' => $entry['direction'],
                'amount' => $amount,
                'currency' => $tenant['currency'],
                'referenceType' => 'Invoice',
                'referenceId' => $invoiceId,
                'description' => 'SaaS invoice ' . $invoiceNumber,
                'createdAt' => $now,
            ]);
        }

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, NULL, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $tenantId,
            'actorUserId' => $superadmin['userId'],
            'actionKey' => 'superadmin.invoice_created',
            'entityType' => 'Invoice',
            'entityId' => $invoiceId,
            'metadataJson' => json_encode([
                'invoiceNumber' => $invoiceNumber,
                'totalAmount' => $amount,
                'note' => $note !== '' ? $note : null,
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);
        notify_workspace_roles(
            $pdo,
            $tenantId,
            null,
            ['owner'],
            'invoice_created',
            'New subscription invoice',
            sprintf('Invoice %s was issued for %s %s.', $invoiceNumber, $tenant['currency'], $amount),
            'Invoice',
            $invoiceId
        );

        $pdo->commit();
    } catch (Throwable $issue) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $issue;
    }

    json_response(superadmin_tenant_detail_payload($pdo, $tenantId));
}

if ($method === 'POST' && preg_match('#^/api/v1/superadmin/invoices/([^/]+)/payments$#', $path, $matches) === 1) {
    $superadmin = require_superadmin($pdo, authenticated_user());
    $invoiceId = trim((string) $matches[1]);
    $payload = json_input();
    $amount = (float) ($payload['amount'] ?? 0);
    $paymentMethod = trim((string) ($payload['paymentMethod'] ?? ''));
    $status = trim((string) ($payload['status'] ?? 'succeeded'));
    $providerReference = trim((string) ($payload['providerReference'] ?? ''));
    $receivedAt = trim((string) ($payload['receivedAt'] ?? ''));
    $note = trim((string) ($payload['note'] ?? ''));

    if ($amount <= 0 || $paymentMethod === '') {
        error_response('Payment amount and method are required');
    }

    if (!in_array($status, ['pending', 'succeeded', 'failed'], true)) {
        error_response('Unsupported payment status');
    }

    $invoiceStatement = $pdo->prepare(
        'SELECT i.id, i.tenantId, i.invoiceNumber, i.totalAmount, i.currency
         FROM Invoice i
         WHERE i.id = :id
         LIMIT 1'
    );
    $invoiceStatement->execute(['id' => $invoiceId]);
    $invoice = db_one($invoiceStatement);
    if (!$invoice) {
        error_response('Invoice not found', 404, 'not_found');
    }

    $paymentId = app_id();
    $now = now_string();
    $formattedAmount = number_format($amount, 2, '.', '');

    $pdo->beginTransaction();
    try {
        $paymentInsert = $pdo->prepare(
            'INSERT INTO Payment
             (id, tenantId, invoiceId, paymentMethod, providerReference, status, amount, currency, receivedAt, createdAt, updatedAt)
             VALUES (:id, :tenantId, :invoiceId, :paymentMethod, :providerReference, :status, :amount, :currency, :receivedAt, :createdAt, :updatedAt)'
        );
        $paymentInsert->execute([
            'id' => $paymentId,
            'tenantId' => $invoice['tenantId'],
            'invoiceId' => $invoiceId,
            'paymentMethod' => $paymentMethod,
            'providerReference' => $providerReference !== '' ? $providerReference : null,
            'status' => $status,
            'amount' => $formattedAmount,
            'currency' => $invoice['currency'],
            'receivedAt' => $receivedAt !== '' ? iso_datetime_string($receivedAt) : $now,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        if ($status === 'succeeded') {
            $invoiceUpdate = $pdo->prepare(
                'UPDATE Invoice
                 SET status = :status,
                     paidAt = :paidAt,
                     updatedAt = :updatedAt
                 WHERE id = :id'
            );
            $invoiceUpdate->execute([
                'status' => 'paid',
                'paidAt' => $receivedAt !== '' ? iso_datetime_string($receivedAt) : $now,
                'updatedAt' => $now,
                'id' => $invoiceId,
            ]);

            $entryGroupId = 'payment:' . $paymentId;
            $ledgerInsert = $pdo->prepare(
                'INSERT INTO LedgerEntry
                 (id, tenantId, entryGroupId, accountCode, direction, amount, currency, referenceType, referenceId, description, createdAt)
                 VALUES (:id, :tenantId, :entryGroupId, :accountCode, :direction, :amount, :currency, :referenceType, :referenceId, :description, :createdAt)'
            );
            foreach ([
                ['accountCode' => 'cash', 'direction' => 'debit'],
                ['accountCode' => 'accounts_receivable', 'direction' => 'credit'],
            ] as $entry) {
                $ledgerInsert->execute([
                    'id' => app_id(),
                    'tenantId' => $invoice['tenantId'],
                    'entryGroupId' => $entryGroupId,
                    'accountCode' => $entry['accountCode'],
                    'direction' => $entry['direction'],
                    'amount' => $formattedAmount,
                    'currency' => $invoice['currency'],
                    'referenceType' => 'Payment',
                    'referenceId' => $paymentId,
                    'description' => 'Payment for invoice ' . $invoice['invoiceNumber'],
                    'createdAt' => $now,
                ]);
            }
        }

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, NULL, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $invoice['tenantId'],
            'actorUserId' => $superadmin['userId'],
            'actionKey' => 'superadmin.payment_recorded',
            'entityType' => 'Payment',
            'entityId' => $paymentId,
            'metadataJson' => json_encode([
                'invoiceNumber' => $invoice['invoiceNumber'],
                'amount' => $formattedAmount,
                'status' => $status,
                'note' => $note !== '' ? $note : null,
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);

        if ($status === 'failed') {
            notify_workspace_roles(
                $pdo,
                $invoice['tenantId'],
                null,
                ['owner'],
                'payment_failed',
                'Payment failed',
                sprintf('A payment attempt for invoice %s failed.', $invoice['invoiceNumber']),
                'Invoice',
                $invoiceId
            );
        } elseif ($status === 'succeeded') {
            notify_workspace_roles(
                $pdo,
                $invoice['tenantId'],
                null,
                ['owner'],
                'payment_received',
                'Payment received',
                sprintf('Payment for invoice %s was recorded successfully.', $invoice['invoiceNumber']),
                'Invoice',
                $invoiceId
            );
        }

        $pdo->commit();
    } catch (Throwable $issue) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $issue;
    }

    json_response(superadmin_tenant_detail_payload($pdo, $invoice['tenantId']));
}

if ($method === 'GET' && $path === '/api/v1/superadmin/support-tickets') {
    require_superadmin($pdo, authenticated_user());
    $tenantId = query_value('tenantId');
    $status = query_value('status');
    $allowedStatuses = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'];

    if ($status !== null && !in_array($status, $allowedStatuses, true)) {
        error_response('Unsupported support ticket status');
    }

    $sql = 'SELECT st.id, st.tenantId, t.name AS tenantName, st.branchId, b.name AS branchName,
                   st.requesterUserId, requester.email AS requesterEmail,
                   st.assignedToUserId, assignee.email AS assignedToEmail,
                   st.subject, st.body, st.category, st.channel, st.priority, st.status,
                   st.internalNote, st.resolutionNote, st.resolvedAt, st.createdAt, st.updatedAt
            FROM SupportTicket st
            INNER JOIN Tenant t ON t.id = st.tenantId
            LEFT JOIN Branch b ON b.id = st.branchId
            INNER JOIN User requester ON requester.id = st.requesterUserId
            LEFT JOIN User assignee ON assignee.id = st.assignedToUserId
            WHERE 1 = 1';
    $params = [];

    if ($tenantId !== null) {
        $sql .= ' AND st.tenantId = :tenantId';
        $params['tenantId'] = $tenantId;
    }

    if ($status !== null) {
        $sql .= ' AND st.status = :status';
        $params['status'] = $status;
    }

    $sql .= ' ORDER BY st.createdAt DESC LIMIT 100';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map('support_ticket_payload', $statement->fetchAll()));
}

if ($method === 'POST' && preg_match('#^/api/v1/superadmin/support-tickets/([^/]+)/status$#', $path, $matches) === 1) {
    $superadmin = require_superadmin($pdo, authenticated_user());
    $ticketId = trim((string) $matches[1]);
    $payload = json_input();
    $status = trim((string) ($payload['status'] ?? ''));
    $internalNote = trim((string) ($payload['internalNote'] ?? ''));
    $resolutionNote = trim((string) ($payload['resolutionNote'] ?? ''));
    $assignedToUserId = trim((string) ($payload['assignedToUserId'] ?? ''));
    $allowedStatuses = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'];

    if (!in_array($status, $allowedStatuses, true)) {
        error_response('Unsupported support ticket status');
    }

    if ($assignedToUserId !== '') {
        $platformUserStatement = $pdo->prepare(
            'SELECT id
             FROM User
             WHERE id = :id
               AND isPlatformUser = 1
               AND status = :status
             LIMIT 1'
        );
        $platformUserStatement->execute([
            'id' => $assignedToUserId,
            'status' => 'active',
        ]);
        if (!db_one($platformUserStatement)) {
            error_response('Assigned platform user not found', 404, 'not_found');
        }
    } else {
        $assignedToUserId = $superadmin['userId'];
    }

    $ticketStatement = $pdo->prepare(
        'SELECT st.id, st.tenantId, t.name AS tenantName, st.branchId, b.name AS branchName,
                st.requesterUserId, requester.email AS requesterEmail,
                st.assignedToUserId, assignee.email AS assignedToEmail,
                st.subject, st.body, st.category, st.channel, st.priority, st.status,
                st.internalNote, st.resolutionNote, st.resolvedAt, st.createdAt, st.updatedAt
         FROM SupportTicket st
         INNER JOIN Tenant t ON t.id = st.tenantId
         LEFT JOIN Branch b ON b.id = st.branchId
         INNER JOIN User requester ON requester.id = st.requesterUserId
         LEFT JOIN User assignee ON assignee.id = st.assignedToUserId
         WHERE st.id = :id
         LIMIT 1'
    );
    $ticketStatement->execute(['id' => $ticketId]);
    $ticket = db_one($ticketStatement);
    if (!$ticket) {
        error_response('Support ticket not found', 404, 'not_found');
    }

    $now = now_string();
    $update = $pdo->prepare(
        'UPDATE SupportTicket
         SET status = :status,
             assignedToUserId = :assignedToUserId,
             internalNote = :internalNote,
             resolutionNote = :resolutionNote,
             resolvedAt = :resolvedAt,
             updatedAt = :updatedAt
         WHERE id = :id'
    );
    $update->execute([
        'status' => $status,
        'assignedToUserId' => $assignedToUserId !== '' ? $assignedToUserId : null,
        'internalNote' => $internalNote !== '' ? $internalNote : null,
        'resolutionNote' => $resolutionNote !== '' ? $resolutionNote : null,
        'resolvedAt' => in_array($status, ['resolved', 'closed'], true) ? $now : null,
        'updatedAt' => $now,
        'id' => $ticketId,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $ticket['tenantId'],
        'branchId' => $ticket['branchId'] ?? null,
        'actorUserId' => $superadmin['userId'],
        'actionKey' => 'superadmin.support_ticket_updated',
        'entityType' => 'SupportTicket',
        'entityId' => $ticketId,
        'metadataJson' => json_encode([
            'fromStatus' => $ticket['status'],
            'toStatus' => $status,
            'assignedToUserId' => $assignedToUserId,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    create_notification(
        $pdo,
        $ticket['tenantId'],
        $ticket['branchId'] ?? null,
        $ticket['requesterUserId'],
        'support_ticket_updated',
        'Support ticket updated',
        sprintf('Your support ticket "%s" is now %s.', $ticket['subject'], str_replace('_', ' ', $status)),
        'SupportTicket',
        $ticketId
    );
    deliver_email_notification(
        (string) ($ticket['requesterEmail'] ?? ''),
        'Support ticket updated',
        sprintf('Your support ticket "%s" is now %s.', $ticket['subject'], str_replace('_', ' ', $status)),
        [
            'tenantId' => $ticket['tenantId'],
            'ticketId' => $ticketId,
            'status' => $status,
        ]
    );

    $ticketStatement->execute(['id' => $ticketId]);
    json_response(support_ticket_payload((array) db_one($ticketStatement)));
}

if ($method === 'POST' && $path === '/api/v1/auth/register-owner') {
    $payload = json_input();
    $email = strtolower(trim((string) ($payload['email'] ?? '')));
    $password = trim((string) ($payload['password'] ?? ''));

    if ($email === '' || $password === '') {
        error_response('Email and password are required');
    }

    $existing = $pdo->prepare('SELECT id FROM User WHERE email = :email LIMIT 1');
    $existing->execute(['email' => $email]);
    if (db_one($existing)) {
        error_response('An account with this email already exists', 409, 'conflict');
    }

    $userId = app_id();
    $statement = $pdo->prepare(
        'INSERT INTO User (id, email, passwordHash, status, isPlatformUser, createdAt, updatedAt)
         VALUES (:id, :email, :passwordHash, :status, 0, :createdAt, :updatedAt)'
    );
    $statement->execute([
        'id' => $userId,
        'email' => $email,
        'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
        'status' => 'active',
        'createdAt' => now_string(),
        'updatedAt' => now_string(),
    ]);

    json_response(build_session($pdo, $userId, $email), 201);
}

if ($method === 'POST' && $path === '/api/v1/auth/register-customer') {
    $payload = json_input();
    $tenantSlug = strtolower(trim((string) ($payload['tenantSlug'] ?? '')));
    $email = strtolower(trim((string) ($payload['email'] ?? '')));
    $password = trim((string) ($payload['password'] ?? ''));
    $fullName = trim((string) ($payload['fullName'] ?? ''));
    $phone = trim((string) ($payload['phone'] ?? ''));
    $marketingConsent = !empty($payload['marketingConsent']) ? 1 : 0;

    if ($tenantSlug === '' || $email === '' || $password === '' || $fullName === '') {
        error_response('Tenant, email, password, and full name are required');
    }

    $tenant = load_public_tenant($pdo, $tenantSlug);
    require_enabled_module($pdo, $tenant['id'], 'customerAccounts', 'Customer accounts are disabled for this workspace');

    $existingUserStatement = $pdo->prepare('SELECT id FROM User WHERE email = :email LIMIT 1');
    $existingUserStatement->execute(['email' => $email]);
    if (db_one($existingUserStatement)) {
        error_response('An account with this email already exists', 409, 'conflict');
    }

    $existingProfileStatement = $pdo->prepare(
        'SELECT id, userId
         FROM CustomerProfile
         WHERE tenantId = :tenantId
           AND LOWER(email) = :email
         ORDER BY createdAt ASC
         LIMIT 1'
    );
    $existingProfileStatement->execute([
        'tenantId' => $tenant['id'],
        'email' => $email,
    ]);
    $existingProfile = db_one($existingProfileStatement);
    if ($existingProfile && !empty($existingProfile['userId'])) {
        error_response('A customer account already exists for this workspace email', 409, 'conflict');
    }

    $userId = app_id();
    $now = now_string();

    $pdo->beginTransaction();
    try {
        $userInsert = $pdo->prepare(
            'INSERT INTO User (id, email, phone, passwordHash, status, isPlatformUser, createdAt, updatedAt)
             VALUES (:id, :email, :phone, :passwordHash, :status, 0, :createdAt, :updatedAt)'
        );
        $userInsert->execute([
            'id' => $userId,
            'email' => $email,
            'phone' => $phone !== '' ? $phone : null,
            'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
            'status' => 'active',
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        if ($existingProfile) {
            $profileUpdate = $pdo->prepare(
                'UPDATE CustomerProfile
                 SET userId = :userId,
                     fullName = :fullName,
                     phone = :phone,
                     email = :email,
                     marketingConsent = :marketingConsent,
                     updatedAt = :updatedAt
                 WHERE id = :id'
            );
            $profileUpdate->execute([
                'userId' => $userId,
                'fullName' => $fullName,
                'phone' => $phone !== '' ? $phone : null,
                'email' => $email,
                'marketingConsent' => $marketingConsent,
                'updatedAt' => $now,
                'id' => $existingProfile['id'],
            ]);
            $customerProfileId = $existingProfile['id'];
        } else {
            $customerProfileId = app_id();
            $profileInsert = $pdo->prepare(
                'INSERT INTO CustomerProfile
                 (id, tenantId, userId, primaryBranchId, fullName, phone, email, marketingConsent, createdAt, updatedAt)
                 VALUES (:id, :tenantId, :userId, NULL, :fullName, :phone, :email, :marketingConsent, :createdAt, :updatedAt)'
            );
            $profileInsert->execute([
                'id' => $customerProfileId,
                'tenantId' => $tenant['id'],
                'userId' => $userId,
                'fullName' => $fullName,
                'phone' => $phone !== '' ? $phone : null,
                'email' => $email,
                'marketingConsent' => $marketingConsent,
                'createdAt' => $now,
                'updatedAt' => $now,
            ]);
        }

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, NULL, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $tenant['id'],
            'actorUserId' => $userId,
            'actionKey' => 'customer.account_registered',
            'entityType' => 'CustomerProfile',
            'entityId' => $customerProfileId,
            'metadataJson' => json_encode([
                'email' => $email,
                'marketingConsent' => (bool) $marketingConsent,
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);

        $pdo->commit();
    } catch (Throwable $issue) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $issue;
    }

    json_response(build_session($pdo, $userId, $email, $tenantSlug), 201);
}

if ($method === 'POST' && $path === '/api/v1/auth/login') {
    $payload = json_input();
    $email = strtolower(trim((string) ($payload['email'] ?? '')));
    $password = trim((string) ($payload['password'] ?? ''));
    $tenantSlug = isset($payload['tenantSlug']) ? strtolower(trim((string) $payload['tenantSlug'])) : null;

    if ($email === '' || $password === '') {
        error_response('Email and password are required');
    }

    $statement = $pdo->prepare('SELECT id, email, passwordHash FROM User WHERE email = :email LIMIT 1');
    $statement->execute(['email' => $email]);
    $user = db_one($statement);

    if (!$user || !password_verify($password, $user['passwordHash'])) {
        error_response('Invalid credentials', 401, 'unauthorized');
    }

    $update = $pdo->prepare('UPDATE User SET lastLoginAt = :lastLoginAt, updatedAt = :updatedAt WHERE id = :id');
    $update->execute([
        'lastLoginAt' => now_string(),
        'updatedAt' => now_string(),
        'id' => $user['id'],
    ]);

    json_response(build_session($pdo, $user['id'], $user['email'], $tenantSlug));
}

if ($method === 'GET' && $path === '/api/v1/auth/me') {
    $authUser = authenticated_user();
    json_response(build_session($pdo, $authUser['sub'], $authUser['email'], $authUser['tenantId'] ?? null));
}

if ($method === 'POST' && $path === '/api/v1/auth/select-tenant') {
    $authUser = authenticated_user();
    $payload = json_input();
    $tenantSlug = strtolower(trim((string) ($payload['tenantSlug'] ?? '')));
    if ($tenantSlug === '') {
        error_response('Tenant slug is required');
    }

    json_response(build_session($pdo, $authUser['sub'], $authUser['email'], $tenantSlug));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/workspaces') {
    $authUser = authenticated_user();

    $statement = $pdo->prepare(
        'SELECT t.id, t.name, t.slug, t.status, t.timezone, t.currency,
                b.id AS branchId, b.name AS branchName, b.code AS branchCode, b.isDefault
         FROM Tenant t
         LEFT JOIN Branch b ON b.tenantId = t.id
         WHERE t.ownerUserId = :ownerUserId
         ORDER BY t.createdAt ASC, b.createdAt ASC'
    );
    $statement->execute(['ownerUserId' => $authUser['sub']]);
    $rows = $statement->fetchAll();

    $grouped = [];
    foreach ($rows as $row) {
        if (!isset($grouped[$row['id']])) {
            $grouped[$row['id']] = [
                'id' => $row['id'],
                'name' => $row['name'],
                'slug' => $row['slug'],
                'status' => $row['status'],
                'timezone' => $row['timezone'],
                'currency' => $row['currency'],
                'branches' => [],
            ];
        }

        if ($row['branchId']) {
            $grouped[$row['id']]['branches'][] = [
                'id' => $row['branchId'],
                'name' => $row['branchName'],
                'code' => $row['branchCode'],
                'timezone' => $row['timezone'],
                'isDefault' => (bool) $row['isDefault'],
            ];
        }
    }

    json_response(array_values($grouped));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/workspaces') {
    $authUser = authenticated_user();
    $payload = json_input();

    $name = trim((string) ($payload['name'] ?? ''));
    $slug = strtolower(trim((string) ($payload['slug'] ?? '')));
    $timezone = trim((string) ($payload['timezone'] ?? ''));
    $currency = strtoupper(trim((string) ($payload['currency'] ?? '')));
    $country = trim((string) ($payload['country'] ?? ''));
    $branch = is_array($payload['branch'] ?? null) ? $payload['branch'] : [];
    $branchName = trim((string) ($branch['name'] ?? ''));
    $branchCode = strtoupper(trim((string) ($branch['code'] ?? '')));

    if ($name === '' || $slug === '' || $timezone === '' || $currency === '' || $country === '' || $branchName === '' || $branchCode === '') {
        error_response('Workspace and branch basics are required');
    }

    $existingTenant = $pdo->prepare('SELECT id FROM Tenant WHERE slug = :slug LIMIT 1');
    $existingTenant->execute(['slug' => $slug]);
    if (db_one($existingTenant)) {
        error_response('Workspace slug is already in use', 409, 'conflict');
    }

    $tenantId = app_id();
    $branchId = app_id();
    $now = now_string();
    $approvedNetworks = array_values(array_filter(array_map('trim', (array) ($branch['approvedNetworkIdentifiers'] ?? []))));

    $pdo->beginTransaction();
    try {
        $tenantInsert = $pdo->prepare(
            'INSERT INTO Tenant
             (id, name, slug, status, ownerUserId, timezone, currency, country, trialEndsAt, activatedAt, createdAt, updatedAt)
             VALUES (:id, :name, :slug, :status, :ownerUserId, :timezone, :currency, :country, :trialEndsAt, :activatedAt, :createdAt, :updatedAt)'
        );
        $tenantInsert->execute([
            'id' => $tenantId,
            'name' => $name,
            'slug' => $slug,
            'status' => 'trial',
            'ownerUserId' => $authUser['sub'],
            'timezone' => $timezone,
            'currency' => $currency,
            'country' => $country,
            'trialEndsAt' => add_days(14),
            'activatedAt' => $now,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $branchInsert = $pdo->prepare(
            'INSERT INTO Branch
             (id, tenantId, name, code, status, city, timezone, phone, email, isDefault, approvedNetworks, createdAt, updatedAt)
             VALUES (:id, :tenantId, :name, :code, :status, :city, :timezone, :phone, :email, :isDefault, :approvedNetworks, :createdAt, :updatedAt)'
        );
        $branchInsert->execute([
            'id' => $branchId,
            'tenantId' => $tenantId,
            'name' => $branchName,
            'code' => $branchCode,
            'status' => 'active',
            'city' => trim((string) ($branch['city'] ?? '')) ?: null,
            'timezone' => trim((string) ($branch['timezone'] ?? '')) ?: $timezone,
            'phone' => trim((string) ($branch['phone'] ?? '')) ?: null,
            'email' => trim((string) ($branch['email'] ?? '')) ?: null,
            'isDefault' => 1,
            'approvedNetworks' => $approvedNetworks ? json_encode($approvedNetworks, JSON_UNESCAPED_SLASHES) : null,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $roleInsert = $pdo->prepare(
            'INSERT INTO Role (id, tenantId, name, roleType, isSystemRole, createdAt, updatedAt)
             VALUES (:id, :tenantId, :name, :roleType, 1, :createdAt, :updatedAt)'
        );
        foreach (['owner', 'manager', 'receptionist', 'employee', 'customer'] as $roleType) {
            $roleInsert->execute([
                'id' => app_id(),
                'tenantId' => $tenantId,
                'name' => ucwords(str_replace('_', ' ', $roleType)),
                'roleType' => $roleType,
                'createdAt' => $now,
                'updatedAt' => $now,
            ]);
        }

        $policyInsert = $pdo->prepare(
            'INSERT INTO WorkspacePolicy (id, tenantId, policyKey, policyValueJson, version, isActive, effectiveFrom, createdAt, updatedAt)
             VALUES (:id, :tenantId, :policyKey, :policyValueJson, 1, 1, :effectiveFrom, :createdAt, :updatedAt)'
        );
        foreach ([
            'booking.cancellationWindowHours' => ['hours' => 4],
            'booking.leadTimeMinutes' => ['minutes' => 120],
            'booking.cleanupBufferMinutes' => ['minutes' => 0],
            'attendance.approvedNetworkRequired' => ['enabled' => true],
            'manager.attendanceCorrections' => ['enabled' => true],
            'manager.staffSuspension' => ['enabled' => true],
        ] as $key => $value) {
            $policyInsert->execute([
                'id' => app_id(),
                'tenantId' => $tenantId,
                'policyKey' => $key,
                'policyValueJson' => json_encode($value, JSON_UNESCAPED_SLASHES),
                'effectiveFrom' => $now,
                'createdAt' => $now,
                'updatedAt' => $now,
            ]);
        }

        $subscriptionInsert = $pdo->prepare(
            'INSERT INTO Subscription (id, tenantId, planCode, status, startedAt, renewsAt, graceEndsAt, createdAt, updatedAt)
             VALUES (:id, :tenantId, :planCode, :status, :startedAt, :renewsAt, :graceEndsAt, :createdAt, :updatedAt)'
        );
        $subscriptionInsert->execute([
            'id' => app_id(),
            'tenantId' => $tenantId,
            'planCode' => 'starter-trial',
            'status' => 'trial',
            'startedAt' => $now,
            'renewsAt' => add_days(14),
            'graceEndsAt' => add_days(17),
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $auditInsert = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $auditInsert->execute([
            'id' => app_id(),
            'tenantId' => $tenantId,
            'branchId' => $branchId,
            'actorUserId' => $authUser['sub'],
            'actionKey' => 'tenant.workspace_created',
            'entityType' => 'Tenant',
            'entityId' => $tenantId,
            'metadataJson' => json_encode(['tenantName' => $name, 'branchName' => $branchName], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    json_response([
        'tenant' => [
            'id' => $tenantId,
            'name' => $name,
            'slug' => $slug,
            'status' => 'trial',
        ],
        'branch' => [
            'id' => $branchId,
            'name' => $branchName,
            'code' => $branchCode,
            'timezone' => trim((string) ($branch['timezone'] ?? '')) ?: $timezone,
        ],
    ], 201);
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/branches') {
    $authUser = require_workspace_roles(
        authenticated_user(),
        ['owner', 'manager', 'receptionist', 'employee'],
        'Workspace branch context is required'
    );

    $branchStatement = $pdo->prepare(
        'SELECT id, name, code, timezone, isDefault
         FROM Branch
         WHERE tenantId = :tenantId
         ORDER BY createdAt ASC'
    );
    $branchStatement->execute(['tenantId' => $authUser['tenantId']]);
    $branches = $branchStatement->fetchAll();

    $roomStatement = $pdo->prepare(
        'SELECT id, branchId, name, code, roomType, capacity, cleanupBufferMinutes
         FROM Room
         WHERE tenantId = :tenantId
         ORDER BY createdAt ASC'
    );
    $roomStatement->execute(['tenantId' => $authUser['tenantId']]);
    $rooms = $roomStatement->fetchAll();

    $serviceStatement = $pdo->prepare(
        'SELECT id, branchId, name, code, durationMinutes, price, requiresRoom, requiresEmployeeSkill
         FROM Service
         WHERE tenantId = :tenantId
         ORDER BY createdAt ASC'
    );
    $serviceStatement->execute(['tenantId' => $authUser['tenantId']]);
    $services = $serviceStatement->fetchAll();

    $productStatement = $pdo->prepare(
        'SELECT p.id, p.branchId, p.name, p.sku, p.description, p.unitPrice, p.costPrice, p.status, p.isRetail, p.updatedAt,
                i.id AS inventoryId, i.productId, i.quantityOnHand, i.reorderLevel, i.status AS inventoryStatus,
                i.lastCountedAt, i.updatedAt AS inventoryUpdatedAt
         FROM Product p
         LEFT JOIN InventoryItem i ON i.productId = p.id
         WHERE p.tenantId = :tenantId
         ORDER BY p.createdAt ASC'
    );
    $productStatement->execute(['tenantId' => $authUser['tenantId']]);
    $products = $productStatement->fetchAll();

    $payload = array_map(static function (array $branch) use ($rooms, $services, $products): array {
        return [
            'id' => $branch['id'],
            'name' => $branch['name'],
            'code' => $branch['code'],
            'timezone' => $branch['timezone'],
            'isDefault' => (bool) $branch['isDefault'],
            'rooms' => array_values(array_map(static function (array $room): array {
                return [
                    'id' => $room['id'],
                    'name' => $room['name'],
                    'code' => $room['code'],
                    'roomType' => $room['roomType'],
                    'capacity' => (int) $room['capacity'],
                    'cleanupBufferMinutes' => (int) $room['cleanupBufferMinutes'],
                ];
            }, array_filter($rooms, static fn (array $room): bool => $room['branchId'] === $branch['id']))),
            'services' => array_values(array_map(static function (array $service): array {
                return [
                    'id' => $service['id'],
                    'name' => $service['name'],
                    'code' => $service['code'],
                    'durationMinutes' => (int) $service['durationMinutes'],
                    'price' => (string) $service['price'],
                    'requiresRoom' => (bool) $service['requiresRoom'],
                    'requiresEmployeeSkill' => (bool) $service['requiresEmployeeSkill'],
                ];
            }, array_filter($services, static fn (array $service): bool => $service['branchId'] === $branch['id']))),
            'products' => array_values(array_map('product_payload', array_filter(
                $products,
                static fn (array $product): bool => $product['branchId'] === $branch['id']
            ))),
        ];
    }, $branches);

    json_response($payload);
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/billing-summary') {
    $authUser = require_workspace_roles(
        authenticated_user(),
        ['owner'],
        'Owner billing access is required'
    );

    json_response(tenant_billing_summary_payload($pdo, $authUser['tenantId']));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/reports/operations-summary') {
    $authUser = require_management_workspace(authenticated_user());
    $branchId = trim((string) (query_value('branchId') ?? ''));
    $fromDate = trim((string) (query_value('fromDate') ?? (new DateTimeImmutable('first day of this month', new DateTimeZone('UTC')))->format('Y-m-d')));
    $toDate = trim((string) (query_value('toDate') ?? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d')));

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
    }

    json_response(operations_report_payload(
        $pdo,
        $authUser['tenantId'],
        $branchId !== '' ? $branchId : null,
        $fromDate,
        $toDate
    ));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/support-tickets') {
    $authUser = require_management_workspace(authenticated_user());
    $status = query_value('status');
    $allowedStatuses = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'];

    if ($status !== null && !in_array($status, $allowedStatuses, true)) {
        error_response('Unsupported support ticket status');
    }

    $sql = 'SELECT st.id, st.tenantId, t.name AS tenantName, st.branchId, b.name AS branchName,
                   st.requesterUserId, requester.email AS requesterEmail,
                   st.assignedToUserId, assignee.email AS assignedToEmail,
                   st.subject, st.body, st.category, st.channel, st.priority, st.status,
                   st.internalNote, st.resolutionNote, st.resolvedAt, st.createdAt, st.updatedAt
            FROM SupportTicket st
            INNER JOIN Tenant t ON t.id = st.tenantId
            LEFT JOIN Branch b ON b.id = st.branchId
            INNER JOIN User requester ON requester.id = st.requesterUserId
            LEFT JOIN User assignee ON assignee.id = st.assignedToUserId
            WHERE st.tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($status !== null) {
        $sql .= ' AND st.status = :status';
        $params['status'] = $status;
    }

    if (!empty($authUser['branchId']) && $authUser['role'] === 'manager') {
        $sql .= ' AND (st.branchId IS NULL OR st.branchId = :branchId)';
        $params['branchId'] = $authUser['branchId'];
    }

    $sql .= ' ORDER BY st.createdAt DESC LIMIT 100';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map('support_ticket_payload', $statement->fetchAll()));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/support-tickets') {
    $authUser = require_management_workspace(authenticated_user());
    $payload = json_input();
    $branchId = trim((string) ($payload['branchId'] ?? ($authUser['branchId'] ?? '')));
    $subject = trim((string) ($payload['subject'] ?? ''));
    $body = trim((string) ($payload['body'] ?? ''));
    $category = trim((string) ($payload['category'] ?? 'operations'));
    $priority = trim((string) ($payload['priority'] ?? 'normal'));
    $allowedPriorities = ['low', 'normal', 'high', 'urgent'];

    if ($subject === '' || $body === '') {
        error_response('Support ticket subject and body are required');
    }

    if (!in_array($priority, $allowedPriorities, true)) {
        error_response('Unsupported support ticket priority');
    }

    if ($branchId !== '') {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
    } else {
        $branchId = null;
    }

    $ticketId = app_id();
    $now = now_string();
    $insert = $pdo->prepare(
        'INSERT INTO SupportTicket
         (id, tenantId, branchId, requesterUserId, assignedToUserId, subject, body, category, channel, priority, status, internalNote, resolutionNote, resolvedAt, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :requesterUserId, NULL, :subject, :body, :category, :channel, :priority, :status, NULL, NULL, NULL, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $ticketId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'requesterUserId' => $authUser['userId'],
        'subject' => $subject,
        'body' => $body,
        'category' => $category !== '' ? $category : 'operations',
        'channel' => 'tenant_app',
        'priority' => $priority,
        'status' => 'open',
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'support.ticket_created',
        'entityType' => 'SupportTicket',
        'entityId' => $ticketId,
        'metadataJson' => json_encode([
            'category' => $category !== '' ? $category : 'operations',
            'priority' => $priority,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    $statement = $pdo->prepare(
        'SELECT st.id, st.tenantId, t.name AS tenantName, st.branchId, b.name AS branchName,
                st.requesterUserId, requester.email AS requesterEmail,
                st.assignedToUserId, assignee.email AS assignedToEmail,
                st.subject, st.body, st.category, st.channel, st.priority, st.status,
                st.internalNote, st.resolutionNote, st.resolvedAt, st.createdAt, st.updatedAt
         FROM SupportTicket st
         INNER JOIN Tenant t ON t.id = st.tenantId
         LEFT JOIN Branch b ON b.id = st.branchId
         INNER JOIN User requester ON requester.id = st.requesterUserId
         LEFT JOIN User assignee ON assignee.id = st.assignedToUserId
         WHERE st.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $ticketId]);

    json_response(support_ticket_payload((array) db_one($statement)), 201);
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/policies/operations') {
    $authUser = require_management_workspace(authenticated_user());
    json_response(operation_policy_payload($pdo, $authUser['tenantId']));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/modules') {
    $authUser = require_management_workspace(authenticated_user());
    json_response(module_entitlements_payload($pdo, $authUser['tenantId']));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/policies/operations') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();
    $managerCanCorrectAttendance = !empty($payload['managerCanCorrectAttendance']);
    $managerCanSuspendStaff = !empty($payload['managerCanSuspendStaff']);
    $bookingCancellationWindowHours = max(0, (int) ($payload['bookingCancellationWindowHours'] ?? 4));
    $bookingLeadTimeMinutes = max(0, (int) ($payload['bookingLeadTimeMinutes'] ?? 120));
    $cleanupBufferMinutes = max(0, (int) ($payload['cleanupBufferMinutes'] ?? 0));
    $sensitiveInventoryAdjustments = !empty($payload['sensitiveInventoryAdjustments']);
    $sensitiveAttendanceCorrections = !empty($payload['sensitiveAttendanceCorrections']);
    $sensitiveAppointmentStatusChanges = !empty($payload['sensitiveAppointmentStatusChanges']);
    $sensitiveEmployeeStatusChanges = !empty($payload['sensitiveEmployeeStatusChanges']);

    upsert_workspace_policy(
        $pdo,
        $authUser['tenantId'],
        'manager.attendanceCorrections',
        ['enabled' => $managerCanCorrectAttendance]
    );
    upsert_workspace_policy(
        $pdo,
        $authUser['tenantId'],
        'manager.staffSuspension',
        ['enabled' => $managerCanSuspendStaff]
    );
    upsert_workspace_policy(
        $pdo,
        $authUser['tenantId'],
        'booking.cancellationWindowHours',
        ['hours' => $bookingCancellationWindowHours]
    );
    upsert_workspace_policy(
        $pdo,
        $authUser['tenantId'],
        'booking.leadTimeMinutes',
        ['minutes' => $bookingLeadTimeMinutes]
    );
    upsert_workspace_policy(
        $pdo,
        $authUser['tenantId'],
        'booking.cleanupBufferMinutes',
        ['minutes' => $cleanupBufferMinutes]
    );
    upsert_workspace_policy(
        $pdo,
        $authUser['tenantId'],
        'audit.sensitiveActions',
        [
            'inventoryAdjustments' => $sensitiveInventoryAdjustments,
            'attendanceCorrections' => $sensitiveAttendanceCorrections,
            'appointmentStatusChanges' => $sensitiveAppointmentStatusChanges,
            'employeeStatusChanges' => $sensitiveEmployeeStatusChanges,
        ]
    );

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $authUser['branchId'],
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'tenant.operation_policies_updated',
        'entityType' => 'WorkspacePolicy',
        'entityId' => $authUser['tenantId'],
        'metadataJson' => json_encode([
            'managerCanCorrectAttendance' => $managerCanCorrectAttendance,
            'managerCanSuspendStaff' => $managerCanSuspendStaff,
            'bookingCancellationWindowHours' => $bookingCancellationWindowHours,
            'bookingLeadTimeMinutes' => $bookingLeadTimeMinutes,
            'cleanupBufferMinutes' => $cleanupBufferMinutes,
            'sensitiveInventoryAdjustments' => $sensitiveInventoryAdjustments,
            'sensitiveAttendanceCorrections' => $sensitiveAttendanceCorrections,
            'sensitiveAppointmentStatusChanges' => $sensitiveAppointmentStatusChanges,
            'sensitiveEmployeeStatusChanges' => $sensitiveEmployeeStatusChanges,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => now_string(),
    ]);

    json_response(operation_policy_payload($pdo, $authUser['tenantId']));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/policies/acknowledgement') {
    $authUser = require_owner_workspace(authenticated_user());
    json_response(policy_acknowledgement_payload($pdo, $authUser['tenantId'], $authUser));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/policies/acknowledgement') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();
    $enabled = !empty($payload['enabled']);
    $version = trim((string) ($payload['version'] ?? 'v1'));
    $title = trim((string) ($payload['title'] ?? 'Workspace handbook acknowledgement'));
    $body = trim((string) ($payload['body'] ?? ''));
    $requiredRoles = array_values(array_filter(
        array_map(static fn ($value): string => strtolower(trim((string) $value)), (array) ($payload['requiredRoles'] ?? [])),
        static fn (string $role): bool => in_array($role, ['manager', 'receptionist', 'employee'], true)
    ));

    if ($version === '' || $title === '') {
        error_response('Acknowledgement version and title are required');
    }
    if (!$requiredRoles) {
        $requiredRoles = ['manager', 'receptionist', 'employee'];
    }

    upsert_workspace_policy(
        $pdo,
        $authUser['tenantId'],
        'policy.acknowledgement',
        [
            'enabled' => $enabled,
            'version' => $version,
            'title' => $title,
            'body' => $body,
            'requiredRoles' => $requiredRoles,
        ]
    );

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $authUser['branchId'],
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'tenant.policy_acknowledgement_updated',
        'entityType' => 'WorkspacePolicy',
        'entityId' => $version,
        'metadataJson' => json_encode([
            'enabled' => $enabled,
            'requiredRoles' => $requiredRoles,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => now_string(),
    ]);

    json_response(policy_acknowledgement_payload($pdo, $authUser['tenantId'], $authUser));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/policies/branch-booking') {
    $authUser = require_owner_workspace(authenticated_user());
    $branchId = trim((string) (query_value('branchId') ?? ''));

    if ($branchId === '') {
        error_response('Branch is required');
    }

    assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
    json_response(booking_policy_payload($pdo, $authUser['tenantId'], $branchId));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/policies/branch-booking') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();
    $branchId = trim((string) ($payload['branchId'] ?? ''));

    if ($branchId === '') {
        error_response('Branch is required');
    }

    assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);

    $useWorkspaceCancellationWindow = !empty($payload['useWorkspaceCancellationWindow']);
    $useWorkspaceLeadTime = !empty($payload['useWorkspaceLeadTime']);
    $useWorkspaceCleanupBuffer = !empty($payload['useWorkspaceCleanupBuffer']);
    $bookingCancellationWindowHours = max(0, (int) ($payload['bookingCancellationWindowHours'] ?? 4));
    $bookingLeadTimeMinutes = max(0, (int) ($payload['bookingLeadTimeMinutes'] ?? 120));
    $cleanupBufferMinutes = max(0, (int) ($payload['cleanupBufferMinutes'] ?? 0));

    upsert_branch_policy(
        $pdo,
        $authUser['tenantId'],
        $branchId,
        'booking.cancellationWindowHours',
        [
            'useWorkspaceDefault' => $useWorkspaceCancellationWindow,
            'hours' => $bookingCancellationWindowHours,
        ]
    );
    upsert_branch_policy(
        $pdo,
        $authUser['tenantId'],
        $branchId,
        'booking.leadTimeMinutes',
        [
            'useWorkspaceDefault' => $useWorkspaceLeadTime,
            'minutes' => $bookingLeadTimeMinutes,
        ]
    );
    upsert_branch_policy(
        $pdo,
        $authUser['tenantId'],
        $branchId,
        'booking.cleanupBufferMinutes',
        [
            'useWorkspaceDefault' => $useWorkspaceCleanupBuffer,
            'minutes' => $cleanupBufferMinutes,
        ]
    );

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'tenant.branch_booking_policy_updated',
        'entityType' => 'BranchPolicy',
        'entityId' => $branchId,
        'metadataJson' => json_encode([
            'useWorkspaceCancellationWindow' => $useWorkspaceCancellationWindow,
            'bookingCancellationWindowHours' => $bookingCancellationWindowHours,
            'useWorkspaceLeadTime' => $useWorkspaceLeadTime,
            'bookingLeadTimeMinutes' => $bookingLeadTimeMinutes,
            'useWorkspaceCleanupBuffer' => $useWorkspaceCleanupBuffer,
            'cleanupBufferMinutes' => $cleanupBufferMinutes,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => now_string(),
    ]);

    json_response(booking_policy_payload($pdo, $authUser['tenantId'], $branchId));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/rooms') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();

    $branchId = trim((string) ($payload['branchId'] ?? ''));
    $name = trim((string) ($payload['name'] ?? ''));
    $code = strtoupper(trim((string) ($payload['code'] ?? '')));

    if ($branchId === '' || $name === '' || $code === '') {
        error_response('Branch, room name, and room code are required');
    }

    $branchStatement = $pdo->prepare('SELECT id FROM Branch WHERE id = :id AND tenantId = :tenantId LIMIT 1');
    $branchStatement->execute(['id' => $branchId, 'tenantId' => $authUser['tenantId']]);
    if (!db_one($branchStatement)) {
        error_response('Branch not found in the active workspace');
    }

    $existingStatement = $pdo->prepare('SELECT id FROM Room WHERE branchId = :branchId AND code = :code LIMIT 1');
    $existingStatement->execute(['branchId' => $branchId, 'code' => $code]);
    if (db_one($existingStatement)) {
        error_response('Room code already exists in this branch', 409, 'conflict');
    }

    $roomId = app_id();
    $now = now_string();
    $roomType = trim((string) ($payload['roomType'] ?? ''));
    $capacity = max(1, (int) ($payload['capacity'] ?? 1));
    $cleanup = max(0, (int) ($payload['cleanupBufferMinutes'] ?? 0));

    $insert = $pdo->prepare(
        'INSERT INTO Room
         (id, tenantId, branchId, name, code, roomType, capacity, status, cleanupBufferMinutes, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :name, :code, :roomType, :capacity, :status, :cleanupBufferMinutes, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $roomId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'name' => $name,
        'code' => $code,
        'roomType' => $roomType ?: null,
        'capacity' => $capacity,
        'status' => 'active',
        'cleanupBufferMinutes' => $cleanup,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'tenant.room_created',
        'entityType' => 'Room',
        'entityId' => $roomId,
        'metadataJson' => json_encode(['roomName' => $name, 'roomCode' => $code], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    json_response([
        'id' => $roomId,
        'name' => $name,
        'code' => $code,
        'roomType' => $roomType ?: null,
        'capacity' => $capacity,
        'cleanupBufferMinutes' => $cleanup,
    ], 201);
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/services') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();

    $branchId = trim((string) ($payload['branchId'] ?? ''));
    $name = trim((string) ($payload['name'] ?? ''));
    $code = strtoupper(trim((string) ($payload['code'] ?? '')));
    $duration = (int) ($payload['durationMinutes'] ?? 0);
    $price = (float) ($payload['price'] ?? 0);

    if ($branchId === '' || $name === '' || $code === '' || $duration <= 0 || $price <= 0) {
        error_response('Branch, service name, service code, duration, and price are required');
    }

    $branchStatement = $pdo->prepare('SELECT id FROM Branch WHERE id = :id AND tenantId = :tenantId LIMIT 1');
    $branchStatement->execute(['id' => $branchId, 'tenantId' => $authUser['tenantId']]);
    if (!db_one($branchStatement)) {
        error_response('Branch not found in the active workspace');
    }

    $existingStatement = $pdo->prepare(
        'SELECT id FROM Service WHERE tenantId = :tenantId AND branchId = :branchId AND code = :code LIMIT 1'
    );
    $existingStatement->execute([
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'code' => $code,
    ]);
    if (db_one($existingStatement)) {
        error_response('Service code already exists in this branch', 409, 'conflict');
    }

    $serviceId = app_id();
    $now = now_string();
    $description = trim((string) ($payload['description'] ?? ''));

    $insert = $pdo->prepare(
        'INSERT INTO Service
         (id, tenantId, branchId, name, code, description, durationMinutes, price, status, requiresRoom, requiresEmployeeSkill, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :name, :code, :description, :durationMinutes, :price, :status, :requiresRoom, :requiresEmployeeSkill, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $serviceId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'name' => $name,
        'code' => $code,
        'description' => $description ?: null,
        'durationMinutes' => $duration,
        'price' => number_format($price, 2, '.', ''),
        'status' => 'active',
        'requiresRoom' => empty($payload['requiresRoom']) ? 0 : 1,
        'requiresEmployeeSkill' => empty($payload['requiresEmployeeSkill']) ? 0 : 1,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'tenant.service_created',
        'entityType' => 'Service',
        'entityId' => $serviceId,
        'metadataJson' => json_encode(['serviceName' => $name, 'serviceCode' => $code], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    json_response([
        'id' => $serviceId,
        'name' => $name,
        'code' => $code,
        'durationMinutes' => $duration,
        'price' => number_format($price, 2, '.', ''),
        'requiresRoom' => !empty($payload['requiresRoom']),
        'requiresEmployeeSkill' => !empty($payload['requiresEmployeeSkill']),
    ], 201);
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/products') {
    $authUser = require_owner_workspace(authenticated_user());
    require_enabled_module($pdo, $authUser['tenantId'], 'inventory', 'Inventory and product tools are disabled for this workspace');
    $payload = json_input();

    $branchId = trim((string) ($payload['branchId'] ?? ''));
    $name = trim((string) ($payload['name'] ?? ''));
    $sku = strtoupper(trim((string) ($payload['sku'] ?? '')));
    $unitPrice = (float) ($payload['unitPrice'] ?? 0);
    $costPriceValue = trim((string) ($payload['costPrice'] ?? ''));
    $costPrice = $costPriceValue === '' ? null : (float) $costPriceValue;
    $startingQuantityValue = trim((string) ($payload['startingQuantity'] ?? '0'));
    $startingQuantity = $startingQuantityValue === '' ? 0 : (float) $startingQuantityValue;
    $reorderLevelValue = trim((string) ($payload['reorderLevel'] ?? ''));
    $reorderLevel = $reorderLevelValue === '' ? null : (float) $reorderLevelValue;

    if ($branchId === '' || $name === '' || $sku === '' || $unitPrice <= 0) {
        error_response('Branch, product name, SKU, and unit price are required');
    }

    if ($costPrice !== null && $costPrice < 0) {
        error_response('Cost price cannot be negative');
    }

    if ($startingQuantity < 0) {
        error_response('Starting quantity cannot be negative');
    }

    if ($reorderLevel !== null && $reorderLevel < 0) {
        error_response('Reorder level cannot be negative');
    }

    assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);

    $existingStatement = $pdo->prepare(
        'SELECT id
         FROM Product
         WHERE tenantId = :tenantId
           AND branchId = :branchId
           AND sku = :sku
         LIMIT 1'
    );
    $existingStatement->execute([
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'sku' => $sku,
    ]);
    if (db_one($existingStatement)) {
        error_response('Product SKU already exists in this branch', 409, 'conflict');
    }

    $productId = app_id();
    $inventoryId = app_id();
    $now = now_string();
    $description = trim((string) ($payload['description'] ?? ''));
    $isRetail = array_key_exists('isRetail', $payload) ? !empty($payload['isRetail']) : true;

    $pdo->beginTransaction();
    try {
        $productInsert = $pdo->prepare(
            'INSERT INTO Product
             (id, tenantId, branchId, name, sku, description, unitPrice, costPrice, status, isRetail, createdAt, updatedAt)
             VALUES (:id, :tenantId, :branchId, :name, :sku, :description, :unitPrice, :costPrice, :status, :isRetail, :createdAt, :updatedAt)'
        );
        $productInsert->execute([
            'id' => $productId,
            'tenantId' => $authUser['tenantId'],
            'branchId' => $branchId,
            'name' => $name,
            'sku' => $sku,
            'description' => $description !== '' ? $description : null,
            'unitPrice' => number_format($unitPrice, 2, '.', ''),
            'costPrice' => $costPrice !== null ? number_format($costPrice, 2, '.', '') : null,
            'status' => 'active',
            'isRetail' => $isRetail ? 1 : 0,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $inventoryInsert = $pdo->prepare(
            'INSERT INTO InventoryItem
             (id, tenantId, branchId, productId, quantityOnHand, reorderLevel, status, lastCountedAt, createdAt, updatedAt)
             VALUES (:id, :tenantId, :branchId, :productId, :quantityOnHand, :reorderLevel, :status, :lastCountedAt, :createdAt, :updatedAt)'
        );
        $inventoryInsert->execute([
            'id' => $inventoryId,
            'tenantId' => $authUser['tenantId'],
            'branchId' => $branchId,
            'productId' => $productId,
            'quantityOnHand' => number_format($startingQuantity, 2, '.', ''),
            'reorderLevel' => $reorderLevel !== null ? number_format($reorderLevel, 2, '.', '') : null,
            'status' => 'active',
            'lastCountedAt' => $now,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'branchId' => $branchId,
            'actorUserId' => $authUser['userId'],
            'actionKey' => 'tenant.product_created',
            'entityType' => 'Product',
            'entityId' => $productId,
            'metadataJson' => json_encode([
                'name' => $name,
                'sku' => $sku,
                'startingQuantity' => number_format($startingQuantity, 2, '.', ''),
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);
        $pdo->commit();
    } catch (Throwable $issue) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $issue;
    }

    json_response(product_payload([
        'id' => $productId,
        'branchId' => $branchId,
        'name' => $name,
        'sku' => $sku,
        'description' => $description !== '' ? $description : null,
        'unitPrice' => number_format($unitPrice, 2, '.', ''),
        'costPrice' => $costPrice !== null ? number_format($costPrice, 2, '.', '') : null,
        'status' => 'active',
        'isRetail' => $isRetail ? 1 : 0,
        'inventoryId' => $inventoryId,
        'productId' => $productId,
        'quantityOnHand' => number_format($startingQuantity, 2, '.', ''),
        'reorderLevel' => $reorderLevel !== null ? number_format($reorderLevel, 2, '.', '') : null,
        'inventoryStatus' => 'active',
        'lastCountedAt' => $now,
        'inventoryUpdatedAt' => $now,
    ]), 201);
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/inventory') {
    $authUser = require_management_workspace(authenticated_user());
    require_enabled_module($pdo, $authUser['tenantId'], 'inventory', 'Inventory and product tools are disabled for this workspace');
    $branchId = query_value('branchId') ?: ($authUser['role'] === 'manager' ? ($authUser['branchId'] ?? null) : null);

    if ($branchId) {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        if ($authUser['role'] === 'manager' && !empty($authUser['branchId']) && $authUser['branchId'] !== $branchId) {
            error_response('Managers can only view inventory for their assigned branch', 403, 'forbidden');
        }
    }

    $sql = 'SELECT i.id AS inventoryId, i.branchId, i.productId, i.quantityOnHand, i.reorderLevel,
                   i.status AS inventoryStatus, i.lastCountedAt, i.updatedAt AS inventoryUpdatedAt,
                   p.name AS productName, p.sku AS productSku, p.description AS productDescription,
                   p.unitPrice, p.costPrice, p.isRetail
            FROM InventoryItem i
            INNER JOIN Product p ON p.id = i.productId
            WHERE i.tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($branchId) {
        $sql .= ' AND i.branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    $sql .= ' ORDER BY p.createdAt ASC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map('inventory_payload', $statement->fetchAll()));
}

if ($method === 'POST' && preg_match('#^/api/v1/tenant-management/inventory/([^/]+)/adjust$#', $path, $matches) === 1) {
    $authUser = require_management_workspace(authenticated_user());
    require_enabled_module($pdo, $authUser['tenantId'], 'inventory', 'Inventory and product tools are disabled for this workspace');
    $inventoryId = trim((string) $matches[1]);
    $payload = json_input();

    $quantityOnHand = (float) ($payload['quantityOnHand'] ?? -1);
    $reorderLevelValue = trim((string) ($payload['reorderLevel'] ?? ''));
    $reorderLevel = $reorderLevelValue === '' ? null : (float) $reorderLevelValue;
    $note = trim((string) ($payload['note'] ?? ''));

    if ($quantityOnHand < 0) {
        error_response('Quantity on hand must be zero or greater');
    }

    if ($reorderLevel !== null && $reorderLevel < 0) {
        error_response('Reorder level must be zero or greater');
    }

    $inventoryStatement = $pdo->prepare(
        'SELECT i.id AS inventoryId, i.branchId, i.productId, i.quantityOnHand, i.reorderLevel,
                i.status AS inventoryStatus, i.lastCountedAt, i.updatedAt AS inventoryUpdatedAt,
                p.name AS productName, p.sku AS productSku, p.description AS productDescription,
                p.unitPrice, p.costPrice, p.isRetail
         FROM InventoryItem i
         INNER JOIN Product p ON p.id = i.productId
         WHERE i.id = :id
           AND i.tenantId = :tenantId
         LIMIT 1'
    );
    $inventoryStatement->execute([
        'id' => $inventoryId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $inventory = db_one($inventoryStatement);
    if (!$inventory) {
        error_response('Inventory item not found in the active workspace');
    }

    if ($authUser['role'] === 'manager' && !empty($authUser['branchId']) && $authUser['branchId'] !== $inventory['branchId']) {
        error_response('Managers can only adjust inventory for their assigned branch', 403, 'forbidden');
    }

    $now = now_string();
    $update = $pdo->prepare(
        'UPDATE InventoryItem
         SET quantityOnHand = :quantityOnHand,
             reorderLevel = :reorderLevel,
             lastCountedAt = :lastCountedAt,
             updatedAt = :updatedAt
         WHERE id = :id'
    );
    $update->execute([
        'quantityOnHand' => number_format($quantityOnHand, 2, '.', ''),
        'reorderLevel' => $reorderLevel !== null ? number_format($reorderLevel, 2, '.', '') : null,
        'lastCountedAt' => $now,
        'updatedAt' => $now,
        'id' => $inventoryId,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $inventory['branchId'],
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'tenant.inventory_adjusted',
        'entityType' => 'InventoryItem',
        'entityId' => $inventoryId,
        'metadataJson' => json_encode([
            'productSku' => $inventory['productSku'],
            'fromQuantityOnHand' => (string) $inventory['quantityOnHand'],
            'toQuantityOnHand' => number_format($quantityOnHand, 2, '.', ''),
            'fromReorderLevel' => isset($inventory['reorderLevel']) ? (string) $inventory['reorderLevel'] : null,
            'toReorderLevel' => $reorderLevel !== null ? number_format($reorderLevel, 2, '.', '') : null,
            'note' => $note !== '' ? $note : null,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);
    emit_sensitive_action_audit_if_enabled(
        $pdo,
        $authUser['tenantId'],
        $inventory['branchId'],
        $authUser['userId'],
        'inventoryAdjustments',
        'InventoryItem',
        $inventoryId,
        [
            'actionKey' => 'tenant.inventory_adjusted',
            'productSku' => $inventory['productSku'],
            'fromQuantityOnHand' => (string) $inventory['quantityOnHand'],
            'toQuantityOnHand' => number_format($quantityOnHand, 2, '.', ''),
            'note' => $note !== '' ? $note : null,
        ]
    );

    json_response(inventory_payload([
        'inventoryId' => $inventoryId,
        'branchId' => $inventory['branchId'],
        'productId' => $inventory['productId'],
        'productName' => $inventory['productName'],
        'productSku' => $inventory['productSku'],
        'productDescription' => $inventory['productDescription'] ?? null,
        'unitPrice' => $inventory['unitPrice'],
        'costPrice' => $inventory['costPrice'] ?? null,
        'isRetail' => $inventory['isRetail'],
        'quantityOnHand' => number_format($quantityOnHand, 2, '.', ''),
        'reorderLevel' => $reorderLevel !== null ? number_format($reorderLevel, 2, '.', '') : null,
        'inventoryStatus' => $inventory['inventoryStatus'],
        'lastCountedAt' => $now,
        'inventoryUpdatedAt' => $now,
    ]));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/employees') {
    $authUser = require_frontdesk_workspace(authenticated_user());
    $branchId = query_value('branchId') ?: ($authUser['branchId'] ?? null);

    if ($branchId) {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
    }

    $sql = 'SELECT ep.id, ep.userId, u.email, u.phone, ep.employeeCode, ep.primaryBranchId, ep.employmentStatus,
                   ep.creditEligible, ep.canEarnCommission, ep.createdAt,
                   COALESCE((
                     SELECT r.roleType
                     FROM PermissionGrant pg
                     INNER JOIN Role r ON r.id = pg.roleId
                     WHERE pg.tenantId = ep.tenantId
                       AND pg.userId = ep.userId
                       AND pg.permissionKey = \'workspace.access\'
                       AND pg.effect = \'allow\'
                       AND (pg.branchId IS NULL OR pg.branchId = ep.primaryBranchId)
                     ORDER BY pg.createdAt DESC
                     LIMIT 1
                   ), \'employee\') AS roleType
            FROM EmployeeProfile ep
            INNER JOIN User u ON u.id = ep.userId
            WHERE ep.tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($branchId) {
        $sql .= ' AND ep.primaryBranchId = :branchId';
        $params['branchId'] = $branchId;
    }

    $sql .= ' ORDER BY ep.createdAt ASC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();

    json_response(array_map('employee_payload', $rows));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/employees') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();

    $branchId = trim((string) ($payload['branchId'] ?? ''));
    $email = strtolower(trim((string) ($payload['email'] ?? '')));
    $password = trim((string) ($payload['password'] ?? ''));
    $employeeCode = strtoupper(trim((string) ($payload['employeeCode'] ?? '')));
    $phone = trim((string) ($payload['phone'] ?? ''));
    $roleType = strtolower(trim((string) ($payload['roleType'] ?? 'employee')));
    if (!in_array($roleType, ['employee', 'manager', 'receptionist'], true)) {
        error_response('Unsupported staff role type');
    }

    if ($branchId === '' || $email === '' || $password === '' || $employeeCode === '') {
        error_response('Branch, employee email, password, and employee code are required');
    }

    assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);

    $existingUser = $pdo->prepare('SELECT id FROM User WHERE email = :email LIMIT 1');
    $existingUser->execute(['email' => $email]);
    if (db_one($existingUser)) {
        error_response('An account with this email already exists', 409, 'conflict');
    }

    $existingEmployee = $pdo->prepare(
        'SELECT id FROM EmployeeProfile WHERE tenantId = :tenantId AND employeeCode = :employeeCode LIMIT 1'
    );
    $existingEmployee->execute([
        'tenantId' => $authUser['tenantId'],
        'employeeCode' => $employeeCode,
    ]);
    if (db_one($existingEmployee)) {
        error_response('Employee code already exists in this workspace', 409, 'conflict');
    }

    $userId = app_id();
    $employeeId = app_id();
    $now = now_string();

    $pdo->beginTransaction();
    try {
        $userInsert = $pdo->prepare(
            'INSERT INTO User (id, email, phone, passwordHash, status, isPlatformUser, createdAt, updatedAt)
             VALUES (:id, :email, :phone, :passwordHash, :status, 0, :createdAt, :updatedAt)'
        );
        $userInsert->execute([
            'id' => $userId,
            'email' => $email,
            'phone' => $phone !== '' ? $phone : null,
            'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
            'status' => 'active',
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $employeeInsert = $pdo->prepare(
            'INSERT INTO EmployeeProfile
             (id, tenantId, userId, primaryBranchId, employeeCode, employmentStatus, creditEligible, canEarnCommission, createdAt, updatedAt)
             VALUES (:id, :tenantId, :userId, :primaryBranchId, :employeeCode, :employmentStatus, :creditEligible, :canEarnCommission, :createdAt, :updatedAt)'
        );
        $employeeInsert->execute([
            'id' => $employeeId,
            'tenantId' => $authUser['tenantId'],
            'userId' => $userId,
            'primaryBranchId' => $branchId,
            'employeeCode' => $employeeCode,
            'employmentStatus' => 'active',
            'creditEligible' => empty($payload['creditEligible']) ? 0 : 1,
            'canEarnCommission' => array_key_exists('canEarnCommission', $payload) && empty($payload['canEarnCommission']) ? 0 : 1,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $roleStatement = $pdo->prepare(
            'SELECT id
             FROM Role
             WHERE tenantId = :tenantId AND roleType = :roleType
             LIMIT 1'
        );
        $roleStatement->execute([
            'tenantId' => $authUser['tenantId'],
            'roleType' => $roleType,
        ]);
        $role = db_one($roleStatement);
        if (!$role) {
            error_response('Workspace role could not be resolved for this employee', 500, 'server_error');
        }

        $permissionInsert = $pdo->prepare(
            'INSERT INTO PermissionGrant
             (id, tenantId, userId, roleId, branchId, permissionKey, effect, createdAt, updatedAt)
             VALUES (:id, :tenantId, :userId, :roleId, :branchId, :permissionKey, :effect, :createdAt, :updatedAt)'
        );
        $permissionInsert->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'userId' => $userId,
            'roleId' => $role['id'],
            'branchId' => $branchId,
            'permissionKey' => 'workspace.access',
            'effect' => 'allow',
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'branchId' => $branchId,
            'actorUserId' => $authUser['userId'],
            'actionKey' => 'tenant.employee_created',
            'entityType' => 'EmployeeProfile',
            'entityId' => $employeeId,
            'metadataJson' => json_encode([
                'email' => $email,
                'employeeCode' => $employeeCode,
                'roleType' => $roleType,
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);
        create_notification(
            $pdo,
            $authUser['tenantId'],
            $branchId,
            $userId,
            'employee_invited',
            'Your workspace account is ready',
            sprintf('You have been added to the workspace as a %s.', $roleType),
            'EmployeeProfile',
            $employeeId
        );
        deliver_email_notification(
            $email,
            'Your AdeyApp workspace account is ready',
            sprintf('You have been added to the workspace as a %s.', $roleType),
            ['tenantId' => $authUser['tenantId'], 'employeeId' => $employeeId]
        );

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    json_response(employee_payload([
        'id' => $employeeId,
        'userId' => $userId,
        'email' => $email,
        'phone' => $phone !== '' ? $phone : null,
        'employeeCode' => $employeeCode,
        'roleType' => $roleType,
        'primaryBranchId' => $branchId,
        'employmentStatus' => 'active',
        'creditEligible' => !empty($payload['creditEligible']),
        'canEarnCommission' => !(array_key_exists('canEarnCommission', $payload) && empty($payload['canEarnCommission'])),
        'createdAt' => $now,
    ]), 201);
}

if ($method === 'POST' && preg_match('#^/api/v1/tenant-management/employees/([^/]+)/role$#', $path, $matches) === 1) {
    $authUser = require_owner_workspace(authenticated_user());
    $employeeId = trim((string) $matches[1]);
    $payload = json_input();
    $roleType = strtolower(trim((string) ($payload['roleType'] ?? '')));

    if (!in_array($roleType, ['employee', 'manager', 'receptionist'], true)) {
        error_response('Unsupported staff role type');
    }

    $employeeStatement = $pdo->prepare(
        'SELECT ep.id, ep.tenantId, ep.userId, ep.primaryBranchId, ep.employeeCode, ep.employmentStatus,
                ep.creditEligible, ep.canEarnCommission, ep.createdAt, u.email, u.phone
         FROM EmployeeProfile ep
         INNER JOIN User u ON u.id = ep.userId
         WHERE ep.id = :id AND ep.tenantId = :tenantId
         LIMIT 1'
    );
    $employeeStatement->execute([
        'id' => $employeeId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $employee = db_one($employeeStatement);

    if (!$employee) {
        error_response('Employee not found in the active workspace', 404, 'not_found');
    }

    $roleStatement = $pdo->prepare(
        'SELECT id
         FROM Role
         WHERE tenantId = :tenantId AND roleType = :roleType
         LIMIT 1'
    );
    $roleStatement->execute([
        'tenantId' => $authUser['tenantId'],
        'roleType' => $roleType,
    ]);
    $role = db_one($roleStatement);
    if (!$role) {
        error_response('Workspace role could not be resolved for this employee', 500, 'server_error');
    }

    $now = now_string();
    $pdo->beginTransaction();
    try {
        $deleteGrant = $pdo->prepare(
            'DELETE FROM PermissionGrant
             WHERE tenantId = :tenantId
               AND userId = :userId
               AND permissionKey = :permissionKey
               AND (branchId IS NULL OR branchId = :branchId)'
        );
        $deleteGrant->execute([
            'tenantId' => $authUser['tenantId'],
            'userId' => $employee['userId'],
            'permissionKey' => 'workspace.access',
            'branchId' => $employee['primaryBranchId'],
        ]);

        $insertGrant = $pdo->prepare(
            'INSERT INTO PermissionGrant
             (id, tenantId, userId, roleId, branchId, permissionKey, effect, createdAt, updatedAt)
             VALUES (:id, :tenantId, :userId, :roleId, :branchId, :permissionKey, :effect, :createdAt, :updatedAt)'
        );
        $insertGrant->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'userId' => $employee['userId'],
            'roleId' => $role['id'],
            'branchId' => $employee['primaryBranchId'],
            'permissionKey' => 'workspace.access',
            'effect' => 'allow',
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'branchId' => $employee['primaryBranchId'],
            'actorUserId' => $authUser['userId'],
            'actionKey' => 'tenant.employee_role_updated',
            'entityType' => 'EmployeeProfile',
            'entityId' => $employeeId,
            'metadataJson' => json_encode([
                'employeeCode' => $employee['employeeCode'],
                'roleType' => $roleType,
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    json_response(employee_payload([
        'id' => $employee['id'],
        'userId' => $employee['userId'],
        'email' => $employee['email'],
        'phone' => $employee['phone'] ?? null,
        'employeeCode' => $employee['employeeCode'],
        'roleType' => $roleType,
        'primaryBranchId' => $employee['primaryBranchId'],
        'employmentStatus' => $employee['employmentStatus'],
        'creditEligible' => $employee['creditEligible'],
        'canEarnCommission' => $employee['canEarnCommission'],
        'createdAt' => $employee['createdAt'],
    ]));
}

if ($method === 'POST' && preg_match('#^/api/v1/tenant-management/employees/([^/]+)/status$#', $path, $matches) === 1) {
    $authUser = require_management_workspace(authenticated_user());
    $employeeId = trim((string) $matches[1]);
    $payload = json_input();
    $employmentStatus = strtolower(trim((string) ($payload['employmentStatus'] ?? '')));
    $note = trim((string) ($payload['note'] ?? ''));
    $finalSettlementConfirmed = array_key_exists('finalSettlementConfirmed', $payload)
        ? !empty($payload['finalSettlementConfirmed'])
        : null;
    $accessRevokedConfirmed = array_key_exists('accessRevokedConfirmed', $payload)
        ? !empty($payload['accessRevokedConfirmed'])
        : null;
    $assetRecoveryConfirmed = array_key_exists('assetRecoveryConfirmed', $payload)
        ? !empty($payload['assetRecoveryConfirmed'])
        : null;
    $creditReviewedConfirmed = array_key_exists('creditReviewedConfirmed', $payload)
        ? !empty($payload['creditReviewedConfirmed'])
        : null;

    $allowedStatuses = ['active', 'suspended_paid', 'suspended_unpaid'];
    if (($authUser['role'] ?? 'manager') === 'owner') {
        $allowedStatuses[] = 'terminated';
    }
    if (!in_array($employmentStatus, $allowedStatuses, true)) {
        error_response('Unsupported employment status for this role');
    }

    $employeeStatement = $pdo->prepare(
        'SELECT ep.id, ep.tenantId, ep.userId, ep.primaryBranchId, ep.employeeCode, ep.employmentStatus,
                ep.creditEligible, ep.canEarnCommission, ep.createdAt, u.email, u.phone
         FROM EmployeeProfile ep
         INNER JOIN User u ON u.id = ep.userId
         WHERE ep.id = :id AND ep.tenantId = :tenantId
         LIMIT 1'
    );
    $employeeStatement->execute([
        'id' => $employeeId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $employee = db_one($employeeStatement);

    if (!$employee) {
        error_response('Employee not found in the active workspace', 404, 'not_found');
    }

    if (($authUser['role'] ?? 'manager') === 'manager' && ($employee['primaryBranchId'] ?? null) !== ($authUser['branchId'] ?? null)) {
        error_response('Managers can only update staff in their active branch', 403, 'forbidden');
    }
    if (($authUser['role'] ?? 'manager') === 'manager') {
        $policy = operation_policy_payload($pdo, $authUser['tenantId']);
        if (!$policy['managerCanSuspendStaff']) {
            error_response('Managers are not allowed to suspend or reactivate staff in this workspace', 403, 'forbidden');
        }
    }
    if ($employmentStatus === 'terminated') {
        if (($authUser['role'] ?? 'manager') !== 'owner') {
            error_response('Only owners can terminate staff accounts', 403, 'forbidden');
        }
        if ($note === '') {
            error_response('A termination note is required');
        }
        foreach ([
            'final settlement confirmation' => $finalSettlementConfirmed,
            'access revocation confirmation' => $accessRevokedConfirmed,
            'asset recovery confirmation' => $assetRecoveryConfirmed,
            'credit review confirmation' => $creditReviewedConfirmed,
        ] as $label => $value) {
            if ($value === null) {
                error_response('Termination checklist must include ' . $label);
            }
        }
    }

    $now = now_string();
    $update = $pdo->prepare(
        'UPDATE EmployeeProfile
         SET employmentStatus = :employmentStatus,
             terminationDate = :terminationDate,
             updatedAt = :updatedAt
         WHERE id = :id AND tenantId = :tenantId'
    );
    $update->execute([
        'employmentStatus' => $employmentStatus,
        'terminationDate' => $employmentStatus === 'terminated'
            ? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d')
            : null,
        'updatedAt' => $now,
        'id' => $employeeId,
        'tenantId' => $authUser['tenantId'],
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $employee['primaryBranchId'],
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'tenant.employee_status_updated',
        'entityType' => 'EmployeeProfile',
        'entityId' => $employeeId,
        'metadataJson' => json_encode([
            'employeeCode' => $employee['employeeCode'],
            'fromStatus' => $employee['employmentStatus'],
            'toStatus' => $employmentStatus,
            'note' => $note !== '' ? $note : null,
            'finalSettlementConfirmed' => $finalSettlementConfirmed,
            'accessRevokedConfirmed' => $accessRevokedConfirmed,
            'assetRecoveryConfirmed' => $assetRecoveryConfirmed,
            'creditReviewedConfirmed' => $creditReviewedConfirmed,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);
    emit_sensitive_action_audit_if_enabled(
        $pdo,
        $authUser['tenantId'],
        $employee['primaryBranchId'],
        $authUser['userId'],
        'employeeStatusChanges',
        'EmployeeProfile',
        $employeeId,
        [
            'actionKey' => 'tenant.employee_status_updated',
            'employeeCode' => $employee['employeeCode'],
            'fromStatus' => $employee['employmentStatus'],
            'toStatus' => $employmentStatus,
            'note' => $note !== '' ? $note : null,
        ]
    );

    json_response(employee_payload([
        'id' => $employee['id'],
        'userId' => $employee['userId'],
        'email' => $employee['email'],
        'phone' => $employee['phone'] ?? null,
        'employeeCode' => $employee['employeeCode'],
        'roleType' => resolve_staff_role(
            $pdo,
            $authUser['tenantId'],
            $employee['userId'],
            $employee['primaryBranchId']
        ),
        'primaryBranchId' => $employee['primaryBranchId'],
        'employmentStatus' => $employmentStatus,
        'creditEligible' => $employee['creditEligible'],
        'canEarnCommission' => $employee['canEarnCommission'],
        'createdAt' => $employee['createdAt'],
    ]));
}

if ($method === 'POST' && preg_match('#^/api/v1/tenant-management/employees/([^/]+)/credit-eligibility$#', $path, $matches) === 1) {
    $authUser = require_management_workspace(authenticated_user());
    require_enabled_module($pdo, $authUser['tenantId'], 'employeeCredit', 'Employee credit is disabled for this workspace');
    $employeeId = trim((string) $matches[1]);
    $payload = json_input();
    $creditEligible = !empty($payload['creditEligible']);
    $note = trim((string) ($payload['note'] ?? ''));

    $employeeStatement = $pdo->prepare(
        'SELECT ep.id, ep.tenantId, ep.userId, ep.primaryBranchId, ep.employeeCode, ep.employmentStatus,
                ep.creditEligible, ep.canEarnCommission, ep.createdAt, u.email, u.phone
         FROM EmployeeProfile ep
         INNER JOIN User u ON u.id = ep.userId
         WHERE ep.id = :id AND ep.tenantId = :tenantId
         LIMIT 1'
    );
    $employeeStatement->execute([
        'id' => $employeeId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $employee = db_one($employeeStatement);

    if (!$employee) {
        error_response('Employee not found in the active workspace', 404, 'not_found');
    }

    if (($authUser['role'] ?? 'manager') === 'manager' && ($employee['primaryBranchId'] ?? null) !== ($authUser['branchId'] ?? null)) {
        error_response('Managers can only update staff in their active branch', 403, 'forbidden');
    }

    $update = $pdo->prepare(
        'UPDATE EmployeeProfile
         SET creditEligible = :creditEligible,
             updatedAt = :updatedAt
         WHERE id = :id AND tenantId = :tenantId'
    );
    $update->execute([
        'creditEligible' => $creditEligible ? 1 : 0,
        'updatedAt' => now_string(),
        'id' => $employeeId,
        'tenantId' => $authUser['tenantId'],
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $employee['primaryBranchId'],
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'tenant.employee_credit_eligibility_updated',
        'entityType' => 'EmployeeProfile',
        'entityId' => $employeeId,
        'metadataJson' => json_encode([
            'employeeCode' => $employee['employeeCode'],
            'fromCreditEligible' => !empty($employee['creditEligible']),
            'toCreditEligible' => $creditEligible,
            'note' => $note !== '' ? $note : null,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => now_string(),
    ]);

    json_response(employee_payload([
        'id' => $employee['id'],
        'userId' => $employee['userId'],
        'email' => $employee['email'],
        'phone' => $employee['phone'] ?? null,
        'employeeCode' => $employee['employeeCode'],
        'roleType' => resolve_staff_role(
            $pdo,
            $authUser['tenantId'],
            $employee['userId'],
            $employee['primaryBranchId']
        ),
        'primaryBranchId' => $employee['primaryBranchId'],
        'employmentStatus' => $employee['employmentStatus'],
        'creditEligible' => $creditEligible,
        'canEarnCommission' => $employee['canEarnCommission'],
        'createdAt' => $employee['createdAt'],
    ]));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/shift-templates') {
    $authUser = require_management_workspace(authenticated_user());
    $branchId = query_value('branchId') ?: ($authUser['branchId'] ?? null);

    $sql = 'SELECT id, branchId, name, code, startTime, endTime, gracePeriodMinutes, createdAt
            FROM ShiftTemplate
            WHERE tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($branchId) {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        $sql .= ' AND branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    $sql .= ' ORDER BY createdAt ASC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map('shift_template_payload', $statement->fetchAll()));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/shift-templates') {
    $authUser = require_management_workspace(authenticated_user());
    $payload = json_input();

    $branchId = trim((string) ($payload['branchId'] ?? ''));
    $name = trim((string) ($payload['name'] ?? ''));
    $code = strtoupper(trim((string) ($payload['code'] ?? '')));
    $startTime = parse_shift_time_or_fail(trim((string) ($payload['startTime'] ?? '')));
    $endTime = parse_shift_time_or_fail(trim((string) ($payload['endTime'] ?? '')));
    $gracePeriodMinutes = max(0, (int) ($payload['gracePeriodMinutes'] ?? 0));

    if ($branchId === '' || $name === '' || $code === '') {
        error_response('Branch, shift name, and shift code are required');
    }

    assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);

    $existingStatement = $pdo->prepare(
        'SELECT id FROM ShiftTemplate WHERE tenantId = :tenantId AND branchId = :branchId AND code = :code LIMIT 1'
    );
    $existingStatement->execute([
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'code' => $code,
    ]);
    if (db_one($existingStatement)) {
        error_response('Shift code already exists in this branch', 409, 'conflict');
    }

    $shiftTemplateId = app_id();
    $now = now_string();
    $insert = $pdo->prepare(
        'INSERT INTO ShiftTemplate
         (id, tenantId, branchId, name, code, startTime, endTime, gracePeriodMinutes, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :name, :code, :startTime, :endTime, :gracePeriodMinutes, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $shiftTemplateId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'name' => $name,
        'code' => $code,
        'startTime' => $startTime,
        'endTime' => $endTime,
        'gracePeriodMinutes' => $gracePeriodMinutes,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'tenant.shift_template_created',
        'entityType' => 'ShiftTemplate',
        'entityId' => $shiftTemplateId,
        'metadataJson' => json_encode(['code' => $code, 'name' => $name], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    json_response(shift_template_payload([
        'id' => $shiftTemplateId,
        'branchId' => $branchId,
        'name' => $name,
        'code' => $code,
        'startTime' => $startTime,
        'endTime' => $endTime,
        'gracePeriodMinutes' => $gracePeriodMinutes,
        'createdAt' => $now,
    ]), 201);
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/shift-assignments') {
    $authUser = require_management_workspace(authenticated_user());
    $branchId = query_value('branchId') ?: ($authUser['branchId'] ?? null);
    $dateValue = query_value('date') ?? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');

    $sql = 'SELECT sa.id, sa.branchId, sa.employeeId, u.email AS employeeEmail, ep.employeeCode,
                   sa.shiftTemplateId, st.name AS shiftTemplateName, st.code AS shiftTemplateCode,
                   sa.shiftDate, sa.startAt, sa.endAt, st.gracePeriodMinutes, sa.createdAt
            FROM ShiftAssignment sa
            INNER JOIN ShiftTemplate st ON st.id = sa.shiftTemplateId
            INNER JOIN EmployeeProfile ep ON ep.id = sa.employeeId
            INNER JOIN User u ON u.id = ep.userId
            WHERE sa.tenantId = :tenantId
              AND sa.shiftDate = :shiftDate';
    $params = [
        'tenantId' => $authUser['tenantId'],
        'shiftDate' => iso_date_string($dateValue),
    ];

    if ($branchId) {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        $sql .= ' AND sa.branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    $sql .= ' ORDER BY sa.startAt ASC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map('shift_assignment_payload', $statement->fetchAll()));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/shift-assignments') {
    $authUser = require_management_workspace(authenticated_user());
    $payload = json_input();

    $branchId = trim((string) ($payload['branchId'] ?? ''));
    $employeeId = trim((string) ($payload['employeeId'] ?? ''));
    $shiftTemplateId = trim((string) ($payload['shiftTemplateId'] ?? ''));
    $shiftDate = iso_date_string(trim((string) ($payload['shiftDate'] ?? '')));

    if ($branchId === '' || $employeeId === '' || $shiftTemplateId === '') {
        error_response('Branch, employee, and shift template are required');
    }

    assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);

    $employeeStatement = $pdo->prepare(
        'SELECT ep.id, ep.employeeCode, u.id AS userId, u.email
         FROM EmployeeProfile ep
         INNER JOIN User u ON u.id = ep.userId
         WHERE ep.id = :id
           AND ep.tenantId = :tenantId
           AND ep.primaryBranchId = :branchId
           AND ep.employmentStatus = :employmentStatus
         LIMIT 1'
    );
    $employeeStatement->execute([
        'id' => $employeeId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'employmentStatus' => 'active',
    ]);
    $employee = db_one($employeeStatement);
    if (!$employee) {
        error_response('Employee not found for the selected branch');
    }

    $templateStatement = $pdo->prepare(
        'SELECT id, name, code, startTime, endTime, gracePeriodMinutes
         FROM ShiftTemplate
         WHERE id = :id AND tenantId = :tenantId AND branchId = :branchId
         LIMIT 1'
    );
    $templateStatement->execute([
        'id' => $shiftTemplateId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
    ]);
    $template = db_one($templateStatement);
    if (!$template) {
        error_response('Shift template not found in the selected branch');
    }

    $bounds = build_shift_bounds($shiftDate, $template['startTime'], $template['endTime']);

    $overlapStatement = $pdo->prepare(
        'SELECT id
         FROM ShiftAssignment
         WHERE tenantId = :tenantId
           AND employeeId = :employeeId
           AND shiftDate = :shiftDate
           AND startAt < :endAt
           AND endAt > :startAt
         LIMIT 1'
    );
    $overlapStatement->execute([
        'tenantId' => $authUser['tenantId'],
        'employeeId' => $employeeId,
        'shiftDate' => $shiftDate,
        'startAt' => $bounds['startAt'],
        'endAt' => $bounds['endAt'],
    ]);
    if (db_one($overlapStatement)) {
        error_response('This employee already has an overlapping shift assignment', 409, 'conflict');
    }

    $assignmentId = app_id();
    $now = now_string();
    $insert = $pdo->prepare(
        'INSERT INTO ShiftAssignment
         (id, tenantId, branchId, employeeId, shiftTemplateId, shiftDate, startAt, endAt, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :employeeId, :shiftTemplateId, :shiftDate, :startAt, :endAt, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $assignmentId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'employeeId' => $employeeId,
        'shiftTemplateId' => $shiftTemplateId,
        'shiftDate' => $shiftDate,
        'startAt' => $bounds['startAt'],
        'endAt' => $bounds['endAt'],
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'tenant.shift_assigned',
        'entityType' => 'ShiftAssignment',
        'entityId' => $assignmentId,
        'metadataJson' => json_encode([
            'employeeCode' => $employee['employeeCode'],
            'shiftTemplateCode' => $template['code'],
            'shiftDate' => $shiftDate,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    json_response(shift_assignment_payload([
        'id' => $assignmentId,
        'branchId' => $branchId,
        'employeeId' => $employeeId,
        'employeeEmail' => $employee['email'],
        'employeeCode' => $employee['employeeCode'],
        'shiftTemplateId' => $shiftTemplateId,
        'shiftTemplateName' => $template['name'],
        'shiftTemplateCode' => $template['code'],
        'shiftDate' => $shiftDate,
        'startAt' => $bounds['startAt'],
        'endAt' => $bounds['endAt'],
        'gracePeriodMinutes' => (int) $template['gracePeriodMinutes'],
        'createdAt' => $now,
    ]), 201);
}

if ($method === 'GET' && $path === '/api/v1/reception/customers') {
    $authUser = require_frontdesk_workspace(authenticated_user());
    $branchId = query_value('branchId');
    $search = query_value('search');

    if ($branchId) {
        $branchStatement = $pdo->prepare('SELECT id FROM Branch WHERE id = :id AND tenantId = :tenantId LIMIT 1');
        $branchStatement->execute(['id' => $branchId, 'tenantId' => $authUser['tenantId']]);
        if (!db_one($branchStatement)) {
            error_response('Branch not found in the active workspace');
        }
    }

    $sql = 'SELECT id, fullName, phone, email, primaryBranchId, marketingConsent, notes, createdAt
            FROM CustomerProfile
            WHERE tenantId = :tenantId';
    $params = ['tenantId' => $authUser['tenantId']];

    if ($branchId) {
        $sql .= ' AND (primaryBranchId = :branchId OR primaryBranchId IS NULL)';
        $params['branchId'] = $branchId;
    }

    if ($search) {
        $sql .= ' AND (fullName LIKE :search OR phone LIKE :search OR email LIKE :search)';
        $params['search'] = '%' . $search . '%';
    }

    $sql .= ' ORDER BY createdAt DESC LIMIT 25';

    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();

    json_response(array_map(static function (array $row): array {
        return [
            'id' => $row['id'],
            'fullName' => $row['fullName'],
            'phone' => $row['phone'],
            'email' => $row['email'],
            'primaryBranchId' => $row['primaryBranchId'],
            'marketingConsent' => (bool) $row['marketingConsent'],
            'notes' => $row['notes'],
            'createdAt' => $row['createdAt'],
        ];
    }, $rows));
}

if ($method === 'POST' && $path === '/api/v1/reception/customers') {
    $authUser = require_frontdesk_workspace(authenticated_user());
    $payload = json_input();

    $fullName = trim((string) ($payload['fullName'] ?? ''));
    $phone = trim((string) ($payload['phone'] ?? ''));
    $email = strtolower(trim((string) ($payload['email'] ?? '')));
    $notes = trim((string) ($payload['notes'] ?? ''));
    $branchId = trim((string) ($payload['branchId'] ?? '')) ?: ($authUser['branchId'] ?? '');

    if ($fullName === '') {
        error_response('Customer full name is required');
    }

    if ($branchId === '') {
        error_response('An active branch is required to create a customer');
    }

    $branchStatement = $pdo->prepare('SELECT id FROM Branch WHERE id = :id AND tenantId = :tenantId LIMIT 1');
    $branchStatement->execute(['id' => $branchId, 'tenantId' => $authUser['tenantId']]);
    if (!db_one($branchStatement)) {
        error_response('Branch not found in the active workspace');
    }

    $customerId = app_id();
    $now = now_string();

    $insert = $pdo->prepare(
        'INSERT INTO CustomerProfile
         (id, tenantId, primaryBranchId, fullName, phone, email, notes, marketingConsent, createdAt, updatedAt)
         VALUES (:id, :tenantId, :primaryBranchId, :fullName, :phone, :email, :notes, :marketingConsent, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $customerId,
        'tenantId' => $authUser['tenantId'],
        'primaryBranchId' => $branchId,
        'fullName' => $fullName,
        'phone' => $phone !== '' ? $phone : null,
        'email' => $email !== '' ? $email : null,
        'notes' => $notes !== '' ? $notes : null,
        'marketingConsent' => empty($payload['marketingConsent']) ? 0 : 1,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'reception.customer_created',
        'entityType' => 'CustomerProfile',
        'entityId' => $customerId,
        'metadataJson' => json_encode(['customerName' => $fullName], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    json_response([
        'id' => $customerId,
        'fullName' => $fullName,
        'phone' => $phone !== '' ? $phone : null,
        'email' => $email !== '' ? $email : null,
        'primaryBranchId' => $branchId,
        'marketingConsent' => !empty($payload['marketingConsent']),
        'notes' => $notes !== '' ? $notes : null,
        'createdAt' => $now,
    ], 201);
}

if ($method === 'GET' && $path === '/api/v1/reception/waitlist') {
    $authUser = require_frontdesk_workspace(authenticated_user());
    $branchId = trim((string) (query_value('branchId') ?? '')) ?: ($authUser['branchId'] ?? '');
    $status = trim((string) (query_value('status') ?? ''));

    if ($branchId === '') {
        error_response('An active branch is required to view the waitlist');
    }

    assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);

    $sql = 'SELECT w.id, w.tenantId, w.branchId, w.customerId, c.fullName AS customerName, c.phone AS customerPhone,
                   w.serviceId, s.name AS serviceName, s.code AS serviceCode, w.status, w.preferredStartAt, w.note,
                   w.contactedAt, w.promotedAt, w.closedAt, w.createdAt
            FROM WaitlistEntry w
            INNER JOIN CustomerProfile c ON c.id = w.customerId
            INNER JOIN Service s ON s.id = w.serviceId
            WHERE w.tenantId = :tenantId
              AND w.branchId = :branchId';
    $params = [
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
    ];

    if ($status !== '') {
        if (!in_array($status, ['waiting', 'contacted', 'promoted', 'closed'], true)) {
            error_response('Unsupported waitlist status');
        }
        $sql .= ' AND w.status = :status';
        $params['status'] = $status;
    }

    $sql .= ' ORDER BY w.createdAt ASC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map('waitlist_payload', $statement->fetchAll()));
}

if ($method === 'POST' && $path === '/api/v1/reception/waitlist') {
    $authUser = require_frontdesk_workspace(authenticated_user());
    $payload = json_input();
    $branchId = trim((string) ($payload['branchId'] ?? '')) ?: ($authUser['branchId'] ?? '');
    $customerId = trim((string) ($payload['customerId'] ?? ''));
    $serviceId = trim((string) ($payload['serviceId'] ?? ''));
    $preferredStartAt = trim((string) ($payload['preferredStartAt'] ?? ''));
    $note = trim((string) ($payload['note'] ?? ''));

    if ($branchId === '' || $customerId === '' || $serviceId === '') {
        error_response('Branch, customer, and service are required for the waitlist');
    }

    assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);

    $customerStatement = $pdo->prepare(
        'SELECT id, fullName, phone
         FROM CustomerProfile
         WHERE id = :id AND tenantId = :tenantId
         LIMIT 1'
    );
    $customerStatement->execute([
        'id' => $customerId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $customer = db_one($customerStatement);
    if (!$customer) {
        error_response('Customer not found in the active workspace');
    }

    $serviceStatement = $pdo->prepare(
        'SELECT id, name, code
         FROM Service
         WHERE id = :id AND tenantId = :tenantId AND branchId = :branchId
         LIMIT 1'
    );
    $serviceStatement->execute([
        'id' => $serviceId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
    ]);
    $service = db_one($serviceStatement);
    if (!$service) {
        error_response('Service not found in the selected branch');
    }

    $waitlistId = app_id();
    $now = now_string();
    $insert = $pdo->prepare(
        'INSERT INTO WaitlistEntry
         (id, tenantId, branchId, customerId, serviceId, status, preferredStartAt, note, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :customerId, :serviceId, :status, :preferredStartAt, :note, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $waitlistId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'customerId' => $customerId,
        'serviceId' => $serviceId,
        'status' => 'waiting',
        'preferredStartAt' => $preferredStartAt !== '' ? iso_datetime_string($preferredStartAt) : null,
        'note' => $note !== '' ? $note : null,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'reception.waitlist_created',
        'entityType' => 'WaitlistEntry',
        'entityId' => $waitlistId,
        'metadataJson' => json_encode([
            'customerName' => $customer['fullName'],
            'serviceCode' => $service['code'],
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    json_response(waitlist_payload([
        'id' => $waitlistId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'customerId' => $customerId,
        'customerName' => $customer['fullName'],
        'customerPhone' => $customer['phone'] ?? null,
        'serviceId' => $serviceId,
        'serviceName' => $service['name'],
        'serviceCode' => $service['code'],
        'status' => 'waiting',
        'preferredStartAt' => $preferredStartAt !== '' ? iso_datetime_string($preferredStartAt) : null,
        'note' => $note !== '' ? $note : null,
        'contactedAt' => null,
        'promotedAt' => null,
        'closedAt' => null,
        'createdAt' => $now,
    ]), 201);
}

if ($method === 'POST' && preg_match('#^/api/v1/reception/waitlist/([^/]+)/status$#', $path, $matches) === 1) {
    $authUser = require_frontdesk_workspace(authenticated_user());
    $waitlistId = trim((string) $matches[1]);
    $payload = json_input();
    $status = trim((string) ($payload['status'] ?? ''));
    $note = trim((string) ($payload['note'] ?? ''));

    if (!in_array($status, ['waiting', 'contacted', 'promoted', 'closed'], true)) {
        error_response('Unsupported waitlist status');
    }

    $statement = $pdo->prepare(
        'SELECT w.id, w.tenantId, w.branchId, w.customerId, c.fullName AS customerName, c.phone AS customerPhone,
                w.serviceId, s.name AS serviceName, s.code AS serviceCode, w.status, w.preferredStartAt, w.note,
                w.contactedAt, w.promotedAt, w.closedAt, w.createdAt
         FROM WaitlistEntry w
         INNER JOIN CustomerProfile c ON c.id = w.customerId
         INNER JOIN Service s ON s.id = w.serviceId
         WHERE w.id = :id
           AND w.tenantId = :tenantId
         LIMIT 1'
    );
    $statement->execute([
        'id' => $waitlistId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $entry = db_one($statement);
    if (!$entry) {
        error_response('Waitlist entry not found in the active workspace', 404, 'not_found');
    }

    $now = now_string();
    $update = $pdo->prepare(
        'UPDATE WaitlistEntry
         SET status = :status,
             note = :note,
             contactedAt = :contactedAt,
             closedAt = :closedAt,
             updatedAt = :updatedAt
         WHERE id = :id'
    );
    $update->execute([
        'status' => $status,
        'note' => $note !== '' ? $note : ($entry['note'] ?? null),
        'contactedAt' => $status === 'contacted' ? $now : $entry['contactedAt'],
        'closedAt' => $status === 'closed' ? $now : ($status === 'waiting' ? null : $entry['closedAt']),
        'updatedAt' => $now,
        'id' => $waitlistId,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $entry['branchId'],
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'reception.waitlist_status_updated',
        'entityType' => 'WaitlistEntry',
        'entityId' => $waitlistId,
        'metadataJson' => json_encode([
            'fromStatus' => $entry['status'],
            'toStatus' => $status,
            'note' => $note !== '' ? $note : null,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    $statement->execute([
        'id' => $waitlistId,
        'tenantId' => $authUser['tenantId'],
    ]);
    json_response(waitlist_payload((array) db_one($statement)));
}

if ($method === 'POST' && preg_match('#^/api/v1/reception/waitlist/([^/]+)/promote$#', $path, $matches) === 1) {
    $authUser = require_frontdesk_workspace(authenticated_user());
    $waitlistId = trim((string) $matches[1]);
    $payload = json_input();
    $roomId = trim((string) ($payload['roomId'] ?? ''));
    $employeeId = trim((string) ($payload['employeeId'] ?? ''));
    $startAtInput = trim((string) ($payload['startAt'] ?? ''));
    $notes = trim((string) ($payload['notes'] ?? ''));

    if ($startAtInput === '') {
        error_response('Promotion requires a target appointment start time');
    }

    $waitlistStatement = $pdo->prepare(
        'SELECT w.id, w.tenantId, w.branchId, w.customerId, c.fullName AS customerName, c.phone AS customerPhone,
                w.serviceId, s.name AS serviceName, s.code AS serviceCode, s.durationMinutes, s.price, s.requiresRoom,
                w.status, w.preferredStartAt, w.note, w.contactedAt, w.promotedAt, w.closedAt, w.createdAt
         FROM WaitlistEntry w
         INNER JOIN CustomerProfile c ON c.id = w.customerId
         INNER JOIN Service s ON s.id = w.serviceId
         WHERE w.id = :id
           AND w.tenantId = :tenantId
         LIMIT 1'
    );
    $waitlistStatement->execute([
        'id' => $waitlistId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $entry = db_one($waitlistStatement);
    if (!$entry) {
        error_response('Waitlist entry not found in the active workspace', 404, 'not_found');
    }
    if (!in_array($entry['status'], ['waiting', 'contacted'], true)) {
        error_response('Only waiting or contacted entries can be promoted', 409, 'conflict');
    }

    $branch = assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $entry['branchId']);
    $bookingPolicy = booking_policy_payload($pdo, $authUser['tenantId'], $entry['branchId']);

    $room = null;
    if ($roomId !== '') {
        $roomStatement = $pdo->prepare(
            'SELECT id, name, cleanupBufferMinutes
             FROM Room
             WHERE id = :id AND tenantId = :tenantId AND branchId = :branchId LIMIT 1'
        );
        $roomStatement->execute([
            'id' => $roomId,
            'tenantId' => $authUser['tenantId'],
            'branchId' => $entry['branchId'],
        ]);
        $room = db_one($roomStatement);
        if (!$room) {
            error_response('Room not found in the selected branch');
        }
    }

    $requiresRoom = !empty($entry['requiresRoom']);
    if ($requiresRoom && !$room) {
        error_response('This service requires a room');
    }

    $employee = null;
    if ($employeeId !== '') {
        $employeeStatement = $pdo->prepare(
            'SELECT ep.id, ep.employeeCode, u.id AS userId, u.email
             FROM EmployeeProfile ep
             INNER JOIN User u ON u.id = ep.userId
             WHERE ep.id = :id
               AND ep.tenantId = :tenantId
               AND ep.primaryBranchId = :branchId
               AND ep.employmentStatus = :employmentStatus
             LIMIT 1'
        );
        $employeeStatement->execute([
            'id' => $employeeId,
            'tenantId' => $authUser['tenantId'],
            'branchId' => $entry['branchId'],
            'employmentStatus' => 'active',
        ]);
        $employee = db_one($employeeStatement);
        if (!$employee) {
            error_response('Employee not found for the selected branch');
        }
    }

    $startAt = new DateTimeImmutable(iso_datetime_string($startAtInput), new DateTimeZone('UTC'));
    $endAt = $startAt->modify('+' . (int) $entry['durationMinutes'] . ' minutes');
    assert_booking_lead_time($startAt, (int) $bookingPolicy['bookingLeadTimeMinutes']);

    if ($room) {
        assert_room_available_for_appointment(
            $pdo,
            $authUser['tenantId'],
            $room,
            format_datetime($startAt),
            format_datetime($endAt),
            (int) $bookingPolicy['cleanupBufferMinutes']
        );
    }

    if ($employee) {
        assert_employee_available_for_appointment(
            $pdo,
            $authUser['tenantId'],
            $employee['id'],
            format_datetime($startAt),
            format_datetime($endAt)
        );
    }

    $appointmentId = app_id();
    $lineId = app_id();
    $now = now_string();

    $pdo->beginTransaction();
    try {
        $appointmentInsert = $pdo->prepare(
            'INSERT INTO Appointment
             (id, tenantId, branchId, customerId, roomId, employeeId, status, source, notes, startAt, endAt, createdAt, updatedAt)
             VALUES (:id, :tenantId, :branchId, :customerId, :roomId, :employeeId, :status, :source, :notes, :startAt, :endAt, :createdAt, :updatedAt)'
        );
        $appointmentInsert->execute([
            'id' => $appointmentId,
            'tenantId' => $authUser['tenantId'],
            'branchId' => $entry['branchId'],
            'customerId' => $entry['customerId'],
            'roomId' => $room['id'] ?? null,
            'employeeId' => $employee['id'] ?? null,
            'status' => 'confirmed',
            'source' => 'reception',
            'notes' => $notes !== '' ? $notes : ($entry['note'] ?? null),
            'startAt' => format_datetime($startAt),
            'endAt' => format_datetime($endAt),
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $lineInsert = $pdo->prepare(
            'INSERT INTO AppointmentLine
             (id, tenantId, appointmentId, serviceId, employeeId, durationMinutes, unitPrice, status, createdAt, updatedAt)
             VALUES (:id, :tenantId, :appointmentId, :serviceId, :employeeId, :durationMinutes, :unitPrice, :status, :createdAt, :updatedAt)'
        );
        $lineInsert->execute([
            'id' => $lineId,
            'tenantId' => $authUser['tenantId'],
            'appointmentId' => $appointmentId,
            'serviceId' => $entry['serviceId'],
            'employeeId' => $employee['id'] ?? null,
            'durationMinutes' => (int) $entry['durationMinutes'],
            'unitPrice' => (string) $entry['price'],
            'status' => 'confirmed',
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $waitlistUpdate = $pdo->prepare(
            'UPDATE WaitlistEntry
             SET status = :status,
                 promotedAt = :promotedAt,
                 updatedAt = :updatedAt
             WHERE id = :id'
        );
        $waitlistUpdate->execute([
            'status' => 'promoted',
            'promotedAt' => $now,
            'updatedAt' => $now,
            'id' => $waitlistId,
        ]);

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'branchId' => $entry['branchId'],
            'actorUserId' => $authUser['userId'],
            'actionKey' => 'reception.waitlist_promoted',
            'entityType' => 'WaitlistEntry',
            'entityId' => $waitlistId,
            'metadataJson' => json_encode([
                'appointmentId' => $appointmentId,
                'customerName' => $entry['customerName'],
                'serviceCode' => $entry['serviceCode'],
                'employeeCode' => $employee['employeeCode'] ?? null,
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);

        notify_workspace_roles(
            $pdo,
            $authUser['tenantId'],
            $entry['branchId'],
            ['owner', 'manager', 'receptionist'],
            'waitlist_promoted',
            'Waitlist promoted to booking',
            sprintf('%s was promoted from the waitlist into a confirmed appointment.', $entry['customerName']),
            'Appointment',
            $appointmentId
        );

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    $summary = load_appointment_summary($pdo, $authUser['tenantId'], $appointmentId);
    if (!$summary) {
        error_response('Appointment could not be loaded after promotion', 500, 'server_error');
    }

    json_response($summary, 201);
}

if ($method === 'GET' && $path === '/api/v1/reception/appointments') {
    $authUser = require_frontdesk_workspace(authenticated_user());
    $branchId = query_value('branchId') ?: ($authUser['branchId'] ?? null);
    $dateValue = query_value('date') ?? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');

    $dayStart = new DateTimeImmutable(iso_date_string($dateValue) . ' 00:00:00', new DateTimeZone('UTC'));
    $dayEnd = $dayStart->modify('+1 day');

    $sql = 'SELECT a.id, a.branchId, b.name AS branchName, a.customerId, c.fullName AS customerName, c.phone AS customerPhone,
                   a.roomId, r.name AS roomName, a.employeeId, u.email AS employeeEmail, ep.employeeCode,
                   a.status, a.source, a.notes, a.startAt, a.endAt,
                   a.checkInAt, a.checkOutAt, a.createdAt
            FROM Appointment a
            INNER JOIN Branch b ON b.id = a.branchId
            INNER JOIN CustomerProfile c ON c.id = a.customerId
            LEFT JOIN Room r ON r.id = a.roomId
            LEFT JOIN EmployeeProfile ep ON ep.id = a.employeeId
            LEFT JOIN User u ON u.id = ep.userId
            WHERE a.tenantId = :tenantId
              AND a.startAt >= :dayStart
              AND a.startAt < :dayEnd';
    $params = [
        'tenantId' => $authUser['tenantId'],
        'dayStart' => format_datetime($dayStart),
        'dayEnd' => format_datetime($dayEnd),
    ];

    if ($branchId) {
        $branchStatement = $pdo->prepare('SELECT id FROM Branch WHERE id = :id AND tenantId = :tenantId LIMIT 1');
        $branchStatement->execute(['id' => $branchId, 'tenantId' => $authUser['tenantId']]);
        if (!db_one($branchStatement)) {
            error_response('Branch not found in the active workspace');
        }

        $sql .= ' AND a.branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    $sql .= ' ORDER BY a.startAt ASC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $appointments = $statement->fetchAll();

    $linesByAppointmentId = [];
    if ($appointments) {
        $appointmentIds = array_values(array_map(static fn (array $row): string => $row['id'], $appointments));
        $placeholders = [];
        $lineParams = [];

        foreach ($appointmentIds as $index => $appointmentId) {
            $key = 'appointmentId' . $index;
            $placeholders[] = ':' . $key;
            $lineParams[$key] = $appointmentId;
        }

        $lineStatement = $pdo->prepare(
            'SELECT al.id, al.appointmentId, al.serviceId, s.name AS serviceName, s.code AS serviceCode,
                    al.durationMinutes, al.unitPrice, al.status
             FROM AppointmentLine al
             INNER JOIN Service s ON s.id = al.serviceId
             WHERE al.appointmentId IN (' . implode(', ', $placeholders) . ')
             ORDER BY al.createdAt ASC'
        );
        $lineStatement->execute($lineParams);
        foreach ($lineStatement->fetchAll() as $line) {
            $linesByAppointmentId[$line['appointmentId']][] = [
                'id' => $line['id'],
                'serviceId' => $line['serviceId'],
                'serviceName' => $line['serviceName'],
                'serviceCode' => $line['serviceCode'],
                'durationMinutes' => (int) $line['durationMinutes'],
                'unitPrice' => (string) $line['unitPrice'],
                'status' => $line['status'],
            ];
        }
    }

    json_response(array_map(static function (array $row) use ($linesByAppointmentId): array {
        return [
            'id' => $row['id'],
            'branchId' => $row['branchId'],
            'branchName' => $row['branchName'],
            'customerId' => $row['customerId'],
            'customerName' => $row['customerName'],
            'customerPhone' => $row['customerPhone'],
            'roomId' => $row['roomId'],
            'roomName' => $row['roomName'],
            'employeeId' => $row['employeeId'],
            'employeeEmail' => $row['employeeEmail'],
            'employeeCode' => $row['employeeCode'],
            'status' => $row['status'],
            'source' => $row['source'],
            'notes' => $row['notes'],
            'startAt' => $row['startAt'],
            'endAt' => $row['endAt'],
            'checkInAt' => $row['checkInAt'],
            'checkOutAt' => $row['checkOutAt'],
            'createdAt' => $row['createdAt'],
            'lines' => $linesByAppointmentId[$row['id']] ?? [],
        ];
    }, $appointments));
}

if ($method === 'POST' && $path === '/api/v1/reception/appointments') {
    $authUser = require_frontdesk_workspace(authenticated_user());
    $payload = json_input();

    $branchId = trim((string) ($payload['branchId'] ?? ''));
    $customerId = trim((string) ($payload['customerId'] ?? ''));
    $serviceId = trim((string) ($payload['serviceId'] ?? ''));
    $roomId = trim((string) ($payload['roomId'] ?? ''));
    $employeeId = trim((string) ($payload['employeeId'] ?? ''));
    $startAtInput = trim((string) ($payload['startAt'] ?? ''));
    $notes = trim((string) ($payload['notes'] ?? ''));

    if ($branchId === '' || $customerId === '' || $serviceId === '' || $startAtInput === '') {
        error_response('Branch, customer, service, and start time are required');
    }

    $branch = assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
    $bookingPolicy = booking_policy_payload($pdo, $authUser['tenantId'], $branchId);

    $customerStatement = $pdo->prepare(
        'SELECT id, userId, fullName, phone, email FROM CustomerProfile WHERE id = :id AND tenantId = :tenantId LIMIT 1'
    );
    $customerStatement->execute(['id' => $customerId, 'tenantId' => $authUser['tenantId']]);
    $customer = db_one($customerStatement);
    if (!$customer) {
        error_response('Customer not found in the active workspace');
    }

    $serviceStatement = $pdo->prepare(
        'SELECT id, name, code, durationMinutes, price, requiresRoom
         FROM Service
         WHERE id = :id AND tenantId = :tenantId AND branchId = :branchId LIMIT 1'
    );
    $serviceStatement->execute([
        'id' => $serviceId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
    ]);
    $service = db_one($serviceStatement);
    if (!$service) {
        error_response('Service not found in the selected branch');
    }

    $room = null;
    if ($roomId !== '') {
        $roomStatement = $pdo->prepare(
            'SELECT id, name, cleanupBufferMinutes FROM Room WHERE id = :id AND tenantId = :tenantId AND branchId = :branchId LIMIT 1'
        );
        $roomStatement->execute([
            'id' => $roomId,
            'tenantId' => $authUser['tenantId'],
            'branchId' => $branchId,
        ]);
        $room = db_one($roomStatement);
        if (!$room) {
            error_response('Room not found in the selected branch');
        }
    }

    $requiresRoom = (bool) $service['requiresRoom'];
    if ($requiresRoom && !$room) {
        error_response('This service requires a room');
    }

    $employee = null;
    if ($employeeId !== '') {
        $employeeStatement = $pdo->prepare(
            'SELECT ep.id, ep.employeeCode, u.id AS userId, u.email
             FROM EmployeeProfile ep
             INNER JOIN User u ON u.id = ep.userId
             WHERE ep.id = :id
               AND ep.tenantId = :tenantId
               AND ep.primaryBranchId = :branchId
               AND ep.employmentStatus = :employmentStatus
             LIMIT 1'
        );
        $employeeStatement->execute([
            'id' => $employeeId,
            'tenantId' => $authUser['tenantId'],
            'branchId' => $branchId,
            'employmentStatus' => 'active',
        ]);
        $employee = db_one($employeeStatement);
        if (!$employee) {
            error_response('Employee not found for the selected branch');
        }
    }

    $startAt = new DateTimeImmutable(iso_datetime_string($startAtInput), new DateTimeZone('UTC'));
    $endAt = $startAt->modify('+' . (int) $service['durationMinutes'] . ' minutes');
    assert_booking_lead_time($startAt, (int) $bookingPolicy['bookingLeadTimeMinutes']);

    if ($room) {
        assert_room_available_for_appointment(
            $pdo,
            $authUser['tenantId'],
            $room,
            format_datetime($startAt),
            format_datetime($endAt),
            (int) $bookingPolicy['cleanupBufferMinutes']
        );
    }

    if ($employee) {
        assert_employee_available_for_appointment(
            $pdo,
            $authUser['tenantId'],
            $employee['id'],
            format_datetime($startAt),
            format_datetime($endAt)
        );
    }

    $appointmentId = app_id();
    $lineId = app_id();
    $now = now_string();

    $pdo->beginTransaction();
    try {
        $appointmentInsert = $pdo->prepare(
            'INSERT INTO Appointment
             (id, tenantId, branchId, customerId, roomId, employeeId, status, source, notes, startAt, endAt, createdAt, updatedAt)
             VALUES (:id, :tenantId, :branchId, :customerId, :roomId, :employeeId, :status, :source, :notes, :startAt, :endAt, :createdAt, :updatedAt)'
        );
        $appointmentInsert->execute([
            'id' => $appointmentId,
            'tenantId' => $authUser['tenantId'],
            'branchId' => $branchId,
            'customerId' => $customerId,
            'roomId' => $room['id'] ?? null,
            'employeeId' => $employee['id'] ?? null,
            'status' => 'confirmed',
            'source' => 'reception',
            'notes' => $notes !== '' ? $notes : null,
            'startAt' => format_datetime($startAt),
            'endAt' => format_datetime($endAt),
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $lineInsert = $pdo->prepare(
            'INSERT INTO AppointmentLine
             (id, tenantId, appointmentId, serviceId, employeeId, durationMinutes, unitPrice, status, createdAt, updatedAt)
             VALUES (:id, :tenantId, :appointmentId, :serviceId, :employeeId, :durationMinutes, :unitPrice, :status, :createdAt, :updatedAt)'
        );
        $lineInsert->execute([
            'id' => $lineId,
            'tenantId' => $authUser['tenantId'],
            'appointmentId' => $appointmentId,
            'serviceId' => $service['id'],
            'employeeId' => $employee['id'] ?? null,
            'durationMinutes' => (int) $service['durationMinutes'],
            'unitPrice' => (string) $service['price'],
            'status' => 'confirmed',
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'branchId' => $branchId,
            'actorUserId' => $authUser['userId'],
            'actionKey' => 'reception.appointment_created',
            'entityType' => 'Appointment',
            'entityId' => $appointmentId,
            'metadataJson' => json_encode([
                'customerName' => $customer['fullName'],
                'serviceCode' => $service['code'],
                'employeeCode' => $employee['employeeCode'] ?? null,
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);

        notify_workspace_roles(
            $pdo,
            $authUser['tenantId'],
            $branchId,
            ['owner', 'manager', 'receptionist'],
            'appointment_created',
            'New appointment created',
            sprintf('A booking for %s was created for service %s.', $customer['fullName'], $service['name']),
            'Appointment',
            $appointmentId
        );

        if (!empty($customer['userId'])) {
            create_notification(
                $pdo,
                $authUser['tenantId'],
                $branchId,
                $customer['userId'],
                'booking_confirmed',
                'Booking confirmed',
                sprintf('Your booking for %s in %s was created successfully.', $service['name'], $branch['name']),
                'Appointment',
                $appointmentId
            );
        }

        if (!empty($employee['userId'])) {
            create_notification(
                $pdo,
                $authUser['tenantId'],
                $branchId,
                $employee['userId'],
                'service_assigned',
                'New service assigned',
                sprintf('You were assigned to %s for %s.', $service['name'], $customer['fullName']),
                'Appointment',
                $appointmentId
            );
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    json_response([
        'id' => $appointmentId,
        'branchId' => $branchId,
        'branchName' => $branch['name'],
        'customerId' => $customer['id'],
        'customerName' => $customer['fullName'],
        'customerPhone' => $customer['phone'],
        'roomId' => $room['id'] ?? null,
        'roomName' => $room['name'] ?? null,
        'employeeId' => $employee['id'] ?? null,
        'employeeEmail' => $employee['email'] ?? null,
        'employeeCode' => $employee['employeeCode'] ?? null,
        'status' => 'confirmed',
        'source' => 'reception',
        'notes' => $notes !== '' ? $notes : null,
        'startAt' => format_datetime($startAt),
        'endAt' => format_datetime($endAt),
        'checkInAt' => null,
        'checkOutAt' => null,
        'createdAt' => $now,
        'lines' => [[
            'id' => $lineId,
            'serviceId' => $service['id'],
            'serviceName' => $service['name'],
            'serviceCode' => $service['code'],
            'durationMinutes' => (int) $service['durationMinutes'],
            'unitPrice' => (string) $service['price'],
            'status' => 'confirmed',
        ]],
    ], 201);
}

if ($method === 'POST' && preg_match('#^/api/v1/reception/appointments/([^/]+)/assign-employee$#', $path, $matches) === 1) {
    $authUser = require_frontdesk_workspace(authenticated_user());
    $appointmentId = trim((string) $matches[1]);
    $payload = json_input();
    $employeeId = trim((string) ($payload['employeeId'] ?? ''));

    $statement = $pdo->prepare(
        'SELECT id, branchId, status, startAt, endAt
         FROM Appointment
         WHERE id = :id AND tenantId = :tenantId
         LIMIT 1'
    );
    $statement->execute([
        'id' => $appointmentId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $appointment = db_one($statement);

    if (!$appointment) {
        error_response('Appointment not found in the active workspace', 404, 'not_found');
    }

    if (in_array($appointment['status'], ['completed', 'canceled', 'no_show'], true)) {
        error_response('Closed appointments cannot be reassigned', 409, 'conflict');
    }

    $employee = null;
    if ($employeeId !== '') {
        $employeeStatement = $pdo->prepare(
            'SELECT ep.id, ep.employeeCode, u.email
             FROM EmployeeProfile ep
             INNER JOIN User u ON u.id = ep.userId
             WHERE ep.id = :id
               AND ep.tenantId = :tenantId
               AND ep.primaryBranchId = :branchId
               AND ep.employmentStatus = :employmentStatus
             LIMIT 1'
        );
        $employeeStatement->execute([
            'id' => $employeeId,
            'tenantId' => $authUser['tenantId'],
            'branchId' => $appointment['branchId'],
            'employmentStatus' => 'active',
        ]);
        $employee = db_one($employeeStatement);
        if (!$employee) {
            error_response('Employee not found for the appointment branch');
        }

        assert_employee_available_for_appointment(
            $pdo,
            $authUser['tenantId'],
            $employee['id'],
            $appointment['startAt'],
            $appointment['endAt'],
            $appointmentId
        );
    }

    $now = now_string();
    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare(
            'UPDATE Appointment
             SET employeeId = :employeeId, updatedAt = :updatedAt
             WHERE id = :id AND tenantId = :tenantId'
        );
        $update->execute([
            'employeeId' => $employee['id'] ?? null,
            'updatedAt' => $now,
            'id' => $appointmentId,
            'tenantId' => $authUser['tenantId'],
        ]);

        $lineUpdate = $pdo->prepare(
            'UPDATE AppointmentLine
             SET employeeId = :employeeId, updatedAt = :updatedAt
             WHERE appointmentId = :appointmentId AND tenantId = :tenantId'
        );
        $lineUpdate->execute([
            'employeeId' => $employee['id'] ?? null,
            'updatedAt' => $now,
            'appointmentId' => $appointmentId,
            'tenantId' => $authUser['tenantId'],
        ]);

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'branchId' => $appointment['branchId'],
            'actorUserId' => $authUser['userId'],
            'actionKey' => 'reception.appointment_employee_assigned',
            'entityType' => 'Appointment',
            'entityId' => $appointmentId,
            'metadataJson' => json_encode([
                'employeeId' => $employee['id'] ?? null,
                'employeeCode' => $employee['employeeCode'] ?? null,
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    $summary = load_appointment_summary($pdo, $authUser['tenantId'], $appointmentId);
    if (!$summary) {
        error_response('Appointment could not be loaded after assignment', 500, 'server_error');
    }

    json_response($summary);
}

if ($method === 'POST' && preg_match('#^/api/v1/reception/appointments/([^/]+)/status$#', $path, $matches) === 1) {
    $authUser = require_frontdesk_workspace(authenticated_user());
    $appointmentId = trim((string) $matches[1]);
    $payload = json_input();
    $nextStatus = trim((string) ($payload['status'] ?? ''));

    $allowedTransitions = [
        'draft' => ['confirmed', 'canceled'],
        'confirmed' => ['checked_in', 'canceled', 'no_show'],
        'checked_in' => ['in_service', 'completed', 'canceled'],
        'in_service' => ['completed'],
        'completed' => [],
        'canceled' => [],
        'no_show' => [],
    ];

    if (!isset($allowedTransitions[$nextStatus]) && !in_array($nextStatus, ['confirmed', 'checked_in', 'in_service', 'completed', 'canceled', 'no_show'], true)) {
        error_response('Unsupported appointment status');
    }

    $statement = $pdo->prepare(
        'SELECT a.id, a.tenantId, a.branchId, a.customerId, a.status, a.startAt, a.checkInAt, a.checkOutAt,
                c.userId AS customerUserId, c.fullName AS customerName
         FROM Appointment a
         INNER JOIN CustomerProfile c ON c.id = a.customerId
         WHERE a.id = :id AND a.tenantId = :tenantId
         LIMIT 1'
    );
    $statement->execute([
        'id' => $appointmentId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $appointment = db_one($statement);

    if (!$appointment) {
        error_response('Appointment not found in the active workspace', 404, 'not_found');
    }

    $currentStatus = $appointment['status'];
    if (!in_array($nextStatus, $allowedTransitions[$currentStatus] ?? [], true)) {
        error_response(
            sprintf('Cannot move appointment from %s to %s', $currentStatus, $nextStatus),
            409,
            'conflict'
        );
    }

    if ($nextStatus === 'canceled') {
        $bookingPolicy = booking_policy_payload($pdo, $authUser['tenantId'], $appointment['branchId']);
        assert_cancellation_window(
            new DateTimeImmutable((string) $appointment['startAt'], new DateTimeZone('UTC')),
            (int) $bookingPolicy['bookingCancellationWindowHours']
        );
    }

    $now = now_string();
    $checkInAt = $appointment['checkInAt'];
    $checkOutAt = $appointment['checkOutAt'];

    if ($nextStatus === 'checked_in' && !$checkInAt) {
        $checkInAt = $now;
    }

    if ($nextStatus === 'completed' && !$checkOutAt) {
        $checkOutAt = $now;
    }

    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare(
            'UPDATE Appointment
             SET status = :status, checkInAt = :checkInAt, checkOutAt = :checkOutAt, updatedAt = :updatedAt
             WHERE id = :id AND tenantId = :tenantId'
        );
        $update->execute([
            'status' => $nextStatus,
            'checkInAt' => $checkInAt,
            'checkOutAt' => $checkOutAt,
            'updatedAt' => $now,
            'id' => $appointmentId,
            'tenantId' => $authUser['tenantId'],
        ]);

        $lineUpdate = $pdo->prepare(
            'UPDATE AppointmentLine
             SET status = :status, updatedAt = :updatedAt
             WHERE appointmentId = :appointmentId AND tenantId = :tenantId'
        );
        $lineUpdate->execute([
            'status' => $nextStatus,
            'updatedAt' => $now,
            'appointmentId' => $appointmentId,
            'tenantId' => $authUser['tenantId'],
        ]);

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'branchId' => $appointment['branchId'],
            'actorUserId' => $authUser['userId'],
            'actionKey' => 'reception.appointment_status_updated',
            'entityType' => 'Appointment',
            'entityId' => $appointmentId,
            'metadataJson' => json_encode([
                'fromStatus' => $currentStatus,
                'toStatus' => $nextStatus,
            ], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);
        emit_sensitive_action_audit_if_enabled(
            $pdo,
            $authUser['tenantId'],
            $appointment['branchId'],
            $authUser['userId'],
            'appointmentStatusChanges',
            'Appointment',
            $appointmentId,
            [
                'actionKey' => 'reception.appointment_status_updated',
                'fromStatus' => $currentStatus,
                'toStatus' => $nextStatus,
                'customerName' => $appointment['customerName'],
            ]
        );

        $notificationTitle = $nextStatus === 'canceled' ? 'Appointment canceled' : 'Appointment updated';
        $notificationBody = sprintf('Appointment status moved from %s to %s.', $currentStatus, $nextStatus);
        notify_workspace_roles(
            $pdo,
            $authUser['tenantId'],
            $appointment['branchId'],
            ['owner', 'manager', 'receptionist'],
            'appointment_updated',
            $notificationTitle,
            $notificationBody,
            'Appointment',
            $appointmentId
        );

        if (!empty($appointment['customerUserId'])) {
            create_notification(
                $pdo,
                $authUser['tenantId'],
                $appointment['branchId'],
                $appointment['customerUserId'],
                'appointment_updated',
                $notificationTitle,
                sprintf('Your appointment for %s moved from %s to %s.', $appointment['customerName'], $currentStatus, $nextStatus),
                'Appointment',
                $appointmentId
            );
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    $summary = load_appointment_summary($pdo, $authUser['tenantId'], $appointmentId);
    if (!$summary) {
        error_response('Appointment could not be loaded after the update', 500, 'server_error');
    }

    json_response($summary);
}

if ($method === 'GET' && $path === '/api/v1/employee/appointments') {
    $authUser = require_employee_workspace(authenticated_user());
    $dateValue = query_value('date') ?? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');

    $dayStart = new DateTimeImmutable(iso_date_string($dateValue) . ' 00:00:00', new DateTimeZone('UTC'));
    $dayEnd = $dayStart->modify('+1 day');

    $statement = $pdo->prepare(
        'SELECT a.id
         FROM Appointment a
         WHERE a.tenantId = :tenantId
           AND a.employeeId = :employeeId
           AND a.startAt >= :dayStart
           AND a.startAt < :dayEnd
         ORDER BY a.startAt ASC'
    );
    $statement->execute([
        'tenantId' => $authUser['tenantId'],
        'employeeId' => $authUser['employeeId'],
        'dayStart' => format_datetime($dayStart),
        'dayEnd' => format_datetime($dayEnd),
    ]);

    $items = [];
    foreach ($statement->fetchAll() as $row) {
        $summary = load_appointment_summary($pdo, $authUser['tenantId'], $row['id']);
        if ($summary) {
            $items[] = $summary;
        }
    }

    json_response($items);
}

if ($method === 'GET' && $path === '/api/v1/employee/attendance') {
    $authUser = require_employee_workspace(authenticated_user());
    $dateValue = query_value('date') ?? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');

    $dayStart = new DateTimeImmutable(iso_date_string($dateValue) . ' 00:00:00', new DateTimeZone('UTC'));
    $dayEnd = $dayStart->modify('+1 day');

    $statement = $pdo->prepare(
        'SELECT ar.id, ar.branchId, ar.employeeId, u.email AS employeeEmail, ep.employeeCode,
                ar.shiftAssignmentId, st.name AS shiftTemplateName, ar.attendanceStatus, ar.networkIdentifier,
                ar.gpsLatitude, ar.gpsLongitude, ar.latenessMinutes, ar.exceptionFlag,
                ar.checkInAt, ar.checkOutAt, ar.createdAt
         FROM AttendanceRecord
         ar
         INNER JOIN EmployeeProfile ep ON ep.id = ar.employeeId
         INNER JOIN User u ON u.id = ep.userId
         LEFT JOIN ShiftAssignment sa ON sa.id = ar.shiftAssignmentId
         LEFT JOIN ShiftTemplate st ON st.id = sa.shiftTemplateId
         WHERE ar.tenantId = :tenantId
           AND ar.employeeId = :employeeId
           AND ar.createdAt >= :dayStart
           AND ar.createdAt < :dayEnd
         ORDER BY ar.createdAt DESC'
    );
    $statement->execute([
        'tenantId' => $authUser['tenantId'],
        'employeeId' => $authUser['employeeId'],
        'dayStart' => format_datetime($dayStart),
        'dayEnd' => format_datetime($dayEnd),
    ]);

    json_response(array_map('attendance_payload', $statement->fetchAll()));
}

if ($method === 'POST' && $path === '/api/v1/employee/attendance/check-in') {
    $authUser = require_employee_workspace(authenticated_user());
    $payload = json_input();

    $networkIdentifier = trim((string) ($payload['networkIdentifier'] ?? ''));
    $gpsLatitude = trim((string) ($payload['gpsLatitude'] ?? ''));
    $gpsLongitude = trim((string) ($payload['gpsLongitude'] ?? ''));
    $shiftDate = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');

    validate_attendance_network($pdo, $authUser, $networkIdentifier, 'attendance.check_in_rejected');

    $openStatement = $pdo->prepare(
        'SELECT id
         FROM AttendanceRecord
         WHERE tenantId = :tenantId
           AND employeeId = :employeeId
           AND checkOutAt IS NULL
         ORDER BY createdAt DESC
         LIMIT 1'
    );
    $openStatement->execute([
        'tenantId' => $authUser['tenantId'],
        'employeeId' => $authUser['employeeId'],
    ]);
    if (db_one($openStatement)) {
        error_response('You already have an open attendance check-in', 409, 'conflict');
    }

    $shiftAssignment = shift_assignment_for_employee_date(
        $pdo,
        $authUser['tenantId'],
        $authUser['branchId'],
        $authUser['employeeId'],
        $shiftDate
    );
    $attendanceId = app_id();
    $now = now_string();
    $latenessMinutes = 0;
    $attendanceStatus = 'present';
    $exceptionFlag = 0;

    if ($shiftAssignment) {
        $scheduledStart = new DateTimeImmutable($shiftAssignment['startAt'], new DateTimeZone('UTC'));
        $checkedInAt = new DateTimeImmutable($now, new DateTimeZone('UTC'));
        $latenessMinutes = max(0, (int) floor(($checkedInAt->getTimestamp() - $scheduledStart->getTimestamp()) / 60));
        if ($latenessMinutes > (int) $shiftAssignment['gracePeriodMinutes']) {
            $attendanceStatus = 'late';
            $exceptionFlag = 1;
        }
    }

    $insert = $pdo->prepare(
        'INSERT INTO AttendanceRecord
         (id, tenantId, branchId, employeeId, shiftAssignmentId, attendanceStatus, networkIdentifier, gpsLatitude, gpsLongitude,
          latenessMinutes, exceptionFlag, checkInAt, createdAt, updatedAt)
         VALUES (:id, :tenantId, :branchId, :employeeId, :shiftAssignmentId, :attendanceStatus, :networkIdentifier, :gpsLatitude, :gpsLongitude,
                 :latenessMinutes, :exceptionFlag, :checkInAt, :createdAt, :updatedAt)'
    );
    $insert->execute([
        'id' => $attendanceId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $authUser['branchId'],
        'employeeId' => $authUser['employeeId'],
        'shiftAssignmentId' => $shiftAssignment['id'] ?? null,
        'attendanceStatus' => $attendanceStatus,
        'networkIdentifier' => $networkIdentifier !== '' ? $networkIdentifier : null,
        'gpsLatitude' => $gpsLatitude !== '' ? $gpsLatitude : null,
        'gpsLongitude' => $gpsLongitude !== '' ? $gpsLongitude : null,
        'latenessMinutes' => $latenessMinutes,
        'exceptionFlag' => $exceptionFlag,
        'checkInAt' => $now,
        'createdAt' => $now,
        'updatedAt' => $now,
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $authUser['branchId'],
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'attendance.checked_in',
        'entityType' => 'AttendanceRecord',
        'entityId' => $attendanceId,
        'metadataJson' => json_encode([
            'networkIdentifier' => $networkIdentifier !== '' ? $networkIdentifier : null,
            'shiftAssignmentId' => $shiftAssignment['id'] ?? null,
            'latenessMinutes' => $latenessMinutes,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    $recordStatement = $pdo->prepare(
        'SELECT ar.id, ar.branchId, ar.employeeId, u.email AS employeeEmail, ep.employeeCode,
                ar.shiftAssignmentId, st.name AS shiftTemplateName, ar.attendanceStatus, ar.networkIdentifier,
                ar.gpsLatitude, ar.gpsLongitude, ar.latenessMinutes, ar.exceptionFlag,
                ar.checkInAt, ar.checkOutAt, ar.createdAt
         FROM AttendanceRecord ar
         INNER JOIN EmployeeProfile ep ON ep.id = ar.employeeId
         INNER JOIN User u ON u.id = ep.userId
         LEFT JOIN ShiftAssignment sa ON sa.id = ar.shiftAssignmentId
         LEFT JOIN ShiftTemplate st ON st.id = sa.shiftTemplateId
         WHERE ar.id = :id
         LIMIT 1'
    );
    $recordStatement->execute(['id' => $attendanceId]);
    $record = db_one($recordStatement);

    json_response(attendance_payload($record), 201);
}

if ($method === 'POST' && $path === '/api/v1/employee/attendance/check-out') {
    $authUser = require_employee_workspace(authenticated_user());
    $payload = json_input();

    $networkIdentifier = trim((string) ($payload['networkIdentifier'] ?? ''));
    $gpsLatitude = trim((string) ($payload['gpsLatitude'] ?? ''));
    $gpsLongitude = trim((string) ($payload['gpsLongitude'] ?? ''));

    validate_attendance_network($pdo, $authUser, $networkIdentifier, 'attendance.check_out_rejected');

    $openStatement = $pdo->prepare(
        'SELECT ar.id, ar.branchId, ar.employeeId, u.email AS employeeEmail, ep.employeeCode,
                ar.shiftAssignmentId, st.name AS shiftTemplateName, ar.attendanceStatus, ar.networkIdentifier,
                ar.gpsLatitude, ar.gpsLongitude, ar.latenessMinutes, ar.exceptionFlag,
                ar.checkInAt, ar.checkOutAt, ar.createdAt
         FROM AttendanceRecord ar
         INNER JOIN EmployeeProfile ep ON ep.id = ar.employeeId
         INNER JOIN User u ON u.id = ep.userId
         LEFT JOIN ShiftAssignment sa ON sa.id = ar.shiftAssignmentId
         LEFT JOIN ShiftTemplate st ON st.id = sa.shiftTemplateId
         WHERE ar.tenantId = :tenantId
           AND ar.employeeId = :employeeId
           AND ar.checkOutAt IS NULL
         ORDER BY ar.createdAt DESC
         LIMIT 1'
    );
    $openStatement->execute([
        'tenantId' => $authUser['tenantId'],
        'employeeId' => $authUser['employeeId'],
    ]);
    $record = db_one($openStatement);

    if (!$record) {
        error_response('No open attendance check-in was found for this employee', 409, 'conflict');
    }

    $now = now_string();
    $update = $pdo->prepare(
        'UPDATE AttendanceRecord
         SET networkIdentifier = :networkIdentifier,
             gpsLatitude = :gpsLatitude,
             gpsLongitude = :gpsLongitude,
             checkOutAt = :checkOutAt,
             updatedAt = :updatedAt
         WHERE id = :id'
    );
    $update->execute([
        'networkIdentifier' => $networkIdentifier !== '' ? $networkIdentifier : ($record['networkIdentifier'] ?? null),
        'gpsLatitude' => $gpsLatitude !== '' ? $gpsLatitude : ($record['gpsLatitude'] ?? null),
        'gpsLongitude' => $gpsLongitude !== '' ? $gpsLongitude : ($record['gpsLongitude'] ?? null),
        'checkOutAt' => $now,
        'updatedAt' => $now,
        'id' => $record['id'],
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $authUser['branchId'],
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'attendance.checked_out',
        'entityType' => 'AttendanceRecord',
        'entityId' => $record['id'],
        'metadataJson' => json_encode([
            'networkIdentifier' => $networkIdentifier !== '' ? $networkIdentifier : ($record['networkIdentifier'] ?? null),
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    $recordStatement = $pdo->prepare(
        'SELECT ar.id, ar.branchId, ar.employeeId, u.email AS employeeEmail, ep.employeeCode,
                ar.shiftAssignmentId, st.name AS shiftTemplateName, ar.attendanceStatus, ar.networkIdentifier,
                ar.gpsLatitude, ar.gpsLongitude, ar.latenessMinutes, ar.exceptionFlag,
                ar.checkInAt, ar.checkOutAt, ar.createdAt
         FROM AttendanceRecord ar
         INNER JOIN EmployeeProfile ep ON ep.id = ar.employeeId
         INNER JOIN User u ON u.id = ep.userId
         LEFT JOIN ShiftAssignment sa ON sa.id = ar.shiftAssignmentId
         LEFT JOIN ShiftTemplate st ON st.id = sa.shiftTemplateId
         WHERE ar.id = :id
         LIMIT 1'
    );
    $recordStatement->execute(['id' => $record['id']]);
    $updatedRecord = db_one($recordStatement);

    json_response(attendance_payload($updatedRecord));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/attendance') {
    $authUser = require_management_workspace(authenticated_user());
    $branchId = query_value('branchId') ?: ($authUser['branchId'] ?? null);
    $dateValue = query_value('date') ?? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');

    $dayStart = new DateTimeImmutable(iso_date_string($dateValue) . ' 00:00:00', new DateTimeZone('UTC'));
    $dayEnd = $dayStart->modify('+1 day');

    $sql = 'SELECT ar.id, ar.branchId, ar.employeeId, u.email AS employeeEmail, ep.employeeCode,
                   ar.shiftAssignmentId, st.name AS shiftTemplateName, ar.attendanceStatus, ar.networkIdentifier,
                   ar.gpsLatitude, ar.gpsLongitude, ar.latenessMinutes, ar.exceptionFlag, ar.checkInAt, ar.checkOutAt, ar.createdAt
            FROM AttendanceRecord ar
            INNER JOIN EmployeeProfile ep ON ep.id = ar.employeeId
            INNER JOIN User u ON u.id = ep.userId
            LEFT JOIN ShiftAssignment sa ON sa.id = ar.shiftAssignmentId
            LEFT JOIN ShiftTemplate st ON st.id = sa.shiftTemplateId
            WHERE ar.tenantId = :tenantId
              AND ar.createdAt >= :dayStart
              AND ar.createdAt < :dayEnd';
    $params = [
        'tenantId' => $authUser['tenantId'],
        'dayStart' => format_datetime($dayStart),
        'dayEnd' => format_datetime($dayEnd),
    ];

    if ($branchId) {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        $sql .= ' AND ar.branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    $sql .= ' ORDER BY ar.createdAt DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map('attendance_payload', $statement->fetchAll()));
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/attendance/payroll-summary') {
    $authUser = require_owner_workspace(authenticated_user());
    $branchId = query_value('branchId') ?: ($authUser['branchId'] ?? null);
    $fromDate = query_value('fromDate') ?? (new DateTimeImmutable('first day of this month', new DateTimeZone('UTC')))->format('Y-m-d');
    $toDate = query_value('toDate') ?? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');

    $rangeStart = new DateTimeImmutable(iso_date_string($fromDate) . ' 00:00:00', new DateTimeZone('UTC'));
    $rangeEnd = (new DateTimeImmutable(iso_date_string($toDate) . ' 00:00:00', new DateTimeZone('UTC')))->modify('+1 day');
    if ($rangeEnd <= $rangeStart) {
        error_response('The payroll summary end date must be after the start date');
    }

    if ($branchId) {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
    }

    $payload = attendance_payroll_summary_collection(
        attendance_payroll_rows(
            $pdo,
            $authUser['tenantId'],
            $branchId,
            format_datetime($rangeStart),
            format_datetime($rangeEnd)
        )
    );

    json_response($payload);
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/attendance/payroll-snapshots') {
    $authUser = require_owner_workspace(authenticated_user());
    $branchId = query_value('branchId') ?: ($authUser['branchId'] ?? null);
    $fromDate = query_value('fromDate') ?? (new DateTimeImmutable('first day of this month', new DateTimeZone('UTC')))->format('Y-m-d');
    $toDate = query_value('toDate') ?? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');

    $rangeStart = new DateTimeImmutable(iso_date_string($fromDate) . ' 00:00:00', new DateTimeZone('UTC'));
    $rangeEnd = (new DateTimeImmutable(iso_date_string($toDate) . ' 00:00:00', new DateTimeZone('UTC')))->modify('+1 day');
    if ($rangeEnd <= $rangeStart) {
        error_response('The payroll snapshot end date must be after the start date');
    }

    if ($branchId) {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
    }

    $sql = 'SELECT al.id, al.branchId, al.actorUserId, actor.email AS actorEmail, al.metadataJson, al.createdAt
            FROM AuditLog al
            INNER JOIN User actor ON actor.id = al.actorUserId
            WHERE al.tenantId = :tenantId
              AND al.entityType = :entityType
              AND al.actionKey = :actionKey
              AND al.createdAt >= :rangeStart
              AND al.createdAt < :rangeEnd';
    $params = [
        'tenantId' => $authUser['tenantId'],
        'entityType' => 'PayrollAttendanceSnapshot',
        'actionKey' => 'attendance.payroll_snapshot_created',
        'rangeStart' => format_datetime($rangeStart),
        'rangeEnd' => format_datetime($rangeEnd),
    ];

    if ($branchId) {
        $sql .= ' AND al.branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    $sql .= ' ORDER BY al.createdAt DESC LIMIT 100';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map('attendance_payroll_snapshot_payload', $statement->fetchAll()));
}

if ($method === 'POST' && $path === '/api/v1/tenant-management/attendance/payroll-snapshots') {
    $authUser = require_owner_workspace(authenticated_user());
    $payload = json_input();
    $branchId = trim((string) ($payload['branchId'] ?? ($authUser['branchId'] ?? '')));
    $fromDate = iso_date_string((string) ($payload['fromDate'] ?? ''));
    $toDate = iso_date_string((string) ($payload['toDate'] ?? ''));
    $note = trim((string) ($payload['note'] ?? ''));

    $rangeStart = new DateTimeImmutable($fromDate . ' 00:00:00', new DateTimeZone('UTC'));
    $rangeEnd = (new DateTimeImmutable($toDate . ' 00:00:00', new DateTimeZone('UTC')))->modify('+1 day');
    if ($rangeEnd <= $rangeStart) {
        error_response('The payroll snapshot end date must be after the start date');
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

    $employeeCount = count($summary);
    $totalWorkedMinutes = 0;
    $totalLatenessMinutes = 0;
    $totalExceptions = 0;
    foreach ($summary as $item) {
        $totalWorkedMinutes += (int) $item['totalWorkedMinutes'];
        $totalLatenessMinutes += (int) $item['totalLatenessMinutes'];
        $totalExceptions += (int) $item['exceptionCount'];
    }

    $snapshotId = app_id();
    $now = now_string();
    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => $snapshotId,
        'tenantId' => $authUser['tenantId'],
        'branchId' => $branchId,
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'attendance.payroll_snapshot_created',
        'entityType' => 'PayrollAttendanceSnapshot',
        'entityId' => $snapshotId,
        'metadataJson' => json_encode([
            'fromDate' => $fromDate,
            'toDate' => $toDate,
            'employeeCount' => $employeeCount,
            'totalWorkedMinutes' => $totalWorkedMinutes,
            'totalLatenessMinutes' => $totalLatenessMinutes,
            'totalExceptions' => $totalExceptions,
            'note' => $note !== '' ? $note : null,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);

    $resultStatement = $pdo->prepare(
        'SELECT al.id, al.branchId, al.actorUserId, actor.email AS actorEmail, al.metadataJson, al.createdAt
         FROM AuditLog al
         INNER JOIN User actor ON actor.id = al.actorUserId
         WHERE al.id = :id
         LIMIT 1'
    );
    $resultStatement->execute(['id' => $snapshotId]);
    $snapshot = db_one($resultStatement);

    json_response(attendance_payroll_snapshot_payload($snapshot), 201);
}

if ($method === 'GET' && $path === '/api/v1/tenant-management/attendance/corrections') {
    $authUser = require_management_workspace(authenticated_user());
    $branchId = query_value('branchId') ?: ($authUser['branchId'] ?? null);
    $fromDate = query_value('fromDate') ?? (new DateTimeImmutable('first day of this month', new DateTimeZone('UTC')))->format('Y-m-d');
    $toDate = query_value('toDate') ?? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');

    $rangeStart = new DateTimeImmutable(iso_date_string($fromDate) . ' 00:00:00', new DateTimeZone('UTC'));
    $rangeEnd = (new DateTimeImmutable(iso_date_string($toDate) . ' 00:00:00', new DateTimeZone('UTC')))->modify('+1 day');
    if ($rangeEnd <= $rangeStart) {
        error_response('The correction history end date must be after the start date');
    }

    $sql = 'SELECT al.id, al.entityId AS attendanceId, al.branchId, al.actorUserId, actor.email AS actorEmail,
                   ar.employeeId, employeeUser.email AS employeeEmail, ep.employeeCode, al.metadataJson, al.createdAt
            FROM AuditLog al
            INNER JOIN User actor ON actor.id = al.actorUserId
            LEFT JOIN AttendanceRecord ar ON ar.id = al.entityId
            LEFT JOIN EmployeeProfile ep ON ep.id = ar.employeeId
            LEFT JOIN User employeeUser ON employeeUser.id = ep.userId
            WHERE al.tenantId = :tenantId
              AND al.entityType = :entityType
              AND al.actionKey = :actionKey
              AND al.createdAt >= :rangeStart
              AND al.createdAt < :rangeEnd';
    $params = [
        'tenantId' => $authUser['tenantId'],
        'entityType' => 'AttendanceRecord',
        'actionKey' => 'attendance.corrected',
        'rangeStart' => format_datetime($rangeStart),
        'rangeEnd' => format_datetime($rangeEnd),
    ];

    if ($branchId) {
        assert_branch_belongs_to_tenant($pdo, $authUser['tenantId'], $branchId);
        $sql .= ' AND al.branchId = :branchId';
        $params['branchId'] = $branchId;
    }

    $sql .= ' ORDER BY al.createdAt DESC LIMIT 100';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    json_response(array_map('attendance_correction_payload', $statement->fetchAll()));
}

if ($method === 'POST' && preg_match('#^/api/v1/tenant-management/attendance/([^/]+)/correct$#', $path, $matches) === 1) {
    $authUser = require_management_workspace(authenticated_user());
    $attendanceId = trim((string) $matches[1]);
    $payload = json_input();

    if (($authUser['role'] ?? 'manager') === 'manager') {
        $policy = operation_policy_payload($pdo, $authUser['tenantId']);
        if (!$policy['managerCanCorrectAttendance']) {
            error_response('Managers are not allowed to correct attendance in this workspace', 403, 'forbidden');
        }
    }

    $statement = $pdo->prepare(
        'SELECT ar.id, ar.tenantId, ar.branchId, ar.employeeId, u.email AS employeeEmail, ep.employeeCode,
                ar.shiftAssignmentId, st.name AS shiftTemplateName, ar.attendanceStatus, ar.networkIdentifier,
                ar.gpsLatitude, ar.gpsLongitude, ar.latenessMinutes, ar.exceptionFlag,
                ar.checkInAt, ar.checkOutAt, ar.createdAt
         FROM AttendanceRecord ar
         INNER JOIN EmployeeProfile ep ON ep.id = ar.employeeId
         INNER JOIN User u ON u.id = ep.userId
         LEFT JOIN ShiftAssignment sa ON sa.id = ar.shiftAssignmentId
         LEFT JOIN ShiftTemplate st ON st.id = sa.shiftTemplateId
         WHERE ar.id = :id AND ar.tenantId = :tenantId
         LIMIT 1'
    );
    $statement->execute([
        'id' => $attendanceId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $record = db_one($statement);

    if (!$record) {
        error_response('Attendance record not found in the active workspace', 404, 'not_found');
    }

    $nextStatus = trim((string) ($payload['attendanceStatus'] ?? $record['attendanceStatus']));
    $allowedStatuses = ['present', 'late', 'absent', 'partial', 'flagged'];
    if (!in_array($nextStatus, $allowedStatuses, true)) {
        error_response('Unsupported attendance status');
    }

    $latenessMinutes = array_key_exists('latenessMinutes', $payload)
        ? max(0, (int) $payload['latenessMinutes'])
        : (int) $record['latenessMinutes'];
    $exceptionFlag = array_key_exists('exceptionFlag', $payload)
        ? (!empty($payload['exceptionFlag']) ? 1 : 0)
        : ((int) $record['exceptionFlag']);
    $checkInAt = array_key_exists('checkInAt', $payload)
        ? (($payload['checkInAt'] ?? '') !== '' ? iso_datetime_string((string) $payload['checkInAt']) : null)
        : $record['checkInAt'];
    $checkOutAt = array_key_exists('checkOutAt', $payload)
        ? (($payload['checkOutAt'] ?? '') !== '' ? iso_datetime_string((string) $payload['checkOutAt']) : null)
        : $record['checkOutAt'];
    $note = trim((string) ($payload['note'] ?? ''));
    $now = now_string();

    $update = $pdo->prepare(
        'UPDATE AttendanceRecord
         SET attendanceStatus = :attendanceStatus,
             latenessMinutes = :latenessMinutes,
             exceptionFlag = :exceptionFlag,
             checkInAt = :checkInAt,
             checkOutAt = :checkOutAt,
             updatedAt = :updatedAt
         WHERE id = :id AND tenantId = :tenantId'
    );
    $update->execute([
        'attendanceStatus' => $nextStatus,
        'latenessMinutes' => $latenessMinutes,
        'exceptionFlag' => $exceptionFlag,
        'checkInAt' => $checkInAt,
        'checkOutAt' => $checkOutAt,
        'updatedAt' => $now,
        'id' => $attendanceId,
        'tenantId' => $authUser['tenantId'],
    ]);

    $audit = $pdo->prepare(
        'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
         VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
    );
    $audit->execute([
        'id' => app_id(),
        'tenantId' => $authUser['tenantId'],
        'branchId' => $record['branchId'],
        'actorUserId' => $authUser['userId'],
        'actionKey' => 'attendance.corrected',
        'entityType' => 'AttendanceRecord',
        'entityId' => $attendanceId,
        'metadataJson' => json_encode([
            'fromStatus' => $record['attendanceStatus'],
            'toStatus' => $nextStatus,
            'fromLatenessMinutes' => (int) $record['latenessMinutes'],
            'toLatenessMinutes' => $latenessMinutes,
            'fromExceptionFlag' => (bool) $record['exceptionFlag'],
            'toExceptionFlag' => (bool) $exceptionFlag,
            'note' => $note !== '' ? $note : null,
        ], JSON_UNESCAPED_SLASHES),
        'createdAt' => $now,
    ]);
    emit_sensitive_action_audit_if_enabled(
        $pdo,
        $authUser['tenantId'],
        $record['branchId'],
        $authUser['userId'],
        'attendanceCorrections',
        'AttendanceRecord',
        $attendanceId,
        [
            'actionKey' => 'attendance.corrected',
            'employeeCode' => $record['employeeCode'],
            'fromStatus' => $record['attendanceStatus'],
            'toStatus' => $nextStatus,
            'fromLatenessMinutes' => (int) $record['latenessMinutes'],
            'toLatenessMinutes' => $latenessMinutes,
            'note' => $note !== '' ? $note : null,
        ]
    );

    $resultStatement = $pdo->prepare(
        'SELECT ar.id, ar.branchId, ar.employeeId, u.email AS employeeEmail, ep.employeeCode,
                ar.shiftAssignmentId, st.name AS shiftTemplateName, ar.attendanceStatus, ar.networkIdentifier,
                ar.gpsLatitude, ar.gpsLongitude, ar.latenessMinutes, ar.exceptionFlag,
                ar.checkInAt, ar.checkOutAt, ar.createdAt
         FROM AttendanceRecord ar
         INNER JOIN EmployeeProfile ep ON ep.id = ar.employeeId
         INNER JOIN User u ON u.id = ep.userId
         LEFT JOIN ShiftAssignment sa ON sa.id = ar.shiftAssignmentId
         LEFT JOIN ShiftTemplate st ON st.id = sa.shiftTemplateId
         WHERE ar.id = :id
         LIMIT 1'
    );
    $resultStatement->execute(['id' => $attendanceId]);
    $updatedRecord = db_one($resultStatement);

    json_response(attendance_payload($updatedRecord));
}

if ($method === 'POST' && preg_match('#^/api/v1/employee/appointments/([^/]+)/start-service$#', $path, $matches) === 1) {
    $authUser = require_employee_workspace(authenticated_user());
    $appointmentId = trim((string) $matches[1]);

    $statement = $pdo->prepare(
        'SELECT id, branchId, employeeId, status, checkInAt
         FROM Appointment
         WHERE id = :id AND tenantId = :tenantId
         LIMIT 1'
    );
    $statement->execute([
        'id' => $appointmentId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $appointment = db_one($statement);

    if (!$appointment || $appointment['employeeId'] !== $authUser['employeeId']) {
        error_response('Assigned appointment not found for this employee', 404, 'not_found');
    }

    $attendanceStatement = $pdo->prepare(
        'SELECT id
         FROM AttendanceRecord
         WHERE tenantId = :tenantId
           AND employeeId = :employeeId
           AND branchId = :branchId
           AND checkOutAt IS NULL
         ORDER BY createdAt DESC
         LIMIT 1'
    );
    $attendanceStatement->execute([
        'tenantId' => $authUser['tenantId'],
        'employeeId' => $authUser['employeeId'],
        'branchId' => $appointment['branchId'],
    ]);
    if (!db_one($attendanceStatement)) {
        error_response('Check in for attendance before starting a service', 409, 'attendance_required');
    }

    if (!in_array($appointment['status'], ['confirmed', 'checked_in'], true)) {
        error_response('Only confirmed or checked-in appointments can start service', 409, 'conflict');
    }

    $now = now_string();
    $checkInAt = $appointment['checkInAt'] ?: $now;

    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare(
            'UPDATE Appointment
             SET status = :status, checkInAt = :checkInAt, updatedAt = :updatedAt
             WHERE id = :id AND tenantId = :tenantId'
        );
        $update->execute([
            'status' => 'in_service',
            'checkInAt' => $checkInAt,
            'updatedAt' => $now,
            'id' => $appointmentId,
            'tenantId' => $authUser['tenantId'],
        ]);

        $lineUpdate = $pdo->prepare(
            'UPDATE AppointmentLine
             SET status = :status, updatedAt = :updatedAt
             WHERE appointmentId = :appointmentId AND tenantId = :tenantId AND employeeId = :employeeId'
        );
        $lineUpdate->execute([
            'status' => 'in_service',
            'updatedAt' => $now,
            'appointmentId' => $appointmentId,
            'tenantId' => $authUser['tenantId'],
            'employeeId' => $authUser['employeeId'],
        ]);

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'branchId' => $appointment['branchId'],
            'actorUserId' => $authUser['userId'],
            'actionKey' => 'employee.service_started',
            'entityType' => 'Appointment',
            'entityId' => $appointmentId,
            'metadataJson' => json_encode(['employeeId' => $authUser['employeeId']], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    $summary = load_appointment_summary($pdo, $authUser['tenantId'], $appointmentId);
    if (!$summary) {
        error_response('Appointment could not be loaded after starting service', 500, 'server_error');
    }

    json_response($summary);
}

if ($method === 'POST' && preg_match('#^/api/v1/employee/appointments/([^/]+)/complete-service$#', $path, $matches) === 1) {
    $authUser = require_employee_workspace(authenticated_user());
    $appointmentId = trim((string) $matches[1]);

    $statement = $pdo->prepare(
        'SELECT a.id, a.branchId, a.employeeId, a.status,
                c.userId AS customerUserId, c.fullName AS customerName
         FROM Appointment a
         INNER JOIN CustomerProfile c ON c.id = a.customerId
         WHERE a.id = :id AND a.tenantId = :tenantId
         LIMIT 1'
    );
    $statement->execute([
        'id' => $appointmentId,
        'tenantId' => $authUser['tenantId'],
    ]);
    $appointment = db_one($statement);

    if (!$appointment || $appointment['employeeId'] !== $authUser['employeeId']) {
        error_response('Assigned appointment not found for this employee', 404, 'not_found');
    }

    if (!in_array($appointment['status'], ['checked_in', 'in_service'], true)) {
        error_response('Only checked-in or in-service appointments can be completed', 409, 'conflict');
    }

    $now = now_string();

    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare(
            'UPDATE Appointment
             SET status = :status, checkOutAt = :checkOutAt, updatedAt = :updatedAt
             WHERE id = :id AND tenantId = :tenantId'
        );
        $update->execute([
            'status' => 'completed',
            'checkOutAt' => $now,
            'updatedAt' => $now,
            'id' => $appointmentId,
            'tenantId' => $authUser['tenantId'],
        ]);

        $lineUpdate = $pdo->prepare(
            'UPDATE AppointmentLine
             SET status = :status, updatedAt = :updatedAt
             WHERE appointmentId = :appointmentId AND tenantId = :tenantId AND employeeId = :employeeId'
        );
        $lineUpdate->execute([
            'status' => 'completed',
            'updatedAt' => $now,
            'appointmentId' => $appointmentId,
            'tenantId' => $authUser['tenantId'],
            'employeeId' => $authUser['employeeId'],
        ]);

        $audit = $pdo->prepare(
            'INSERT INTO AuditLog (id, tenantId, branchId, actorUserId, actionKey, entityType, entityId, metadataJson, createdAt)
             VALUES (:id, :tenantId, :branchId, :actorUserId, :actionKey, :entityType, :entityId, :metadataJson, :createdAt)'
        );
        $audit->execute([
            'id' => app_id(),
            'tenantId' => $authUser['tenantId'],
            'branchId' => $appointment['branchId'],
            'actorUserId' => $authUser['userId'],
            'actionKey' => 'employee.service_completed',
            'entityType' => 'Appointment',
            'entityId' => $appointmentId,
            'metadataJson' => json_encode(['employeeId' => $authUser['employeeId']], JSON_UNESCAPED_SLASHES),
            'createdAt' => $now,
        ]);

        if (!empty($appointment['customerUserId'])) {
            create_notification(
                $pdo,
                $authUser['tenantId'],
                $appointment['branchId'],
                $appointment['customerUserId'],
                'appointment_updated',
                'Service completed',
                sprintf('Your appointment for %s is now completed.', $appointment['customerName']),
                'Appointment',
                $appointmentId
            );
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_response($exception->getMessage(), 500, 'server_error');
    }

    $summary = load_appointment_summary($pdo, $authUser['tenantId'], $appointmentId);
    if (!$summary) {
        error_response('Appointment could not be loaded after completion', 500, 'server_error');
    }

    json_response($summary);
}

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'phase2_operations.php';

error_response(sprintf('Cannot %s %s', $method, $path), 404, 'not_found');
