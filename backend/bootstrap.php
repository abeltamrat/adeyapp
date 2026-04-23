<?php

declare(strict_types=1);

date_default_timezone_set('UTC');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function app_root_path(): string
{
    return dirname(__DIR__);
}

function backend_root_path(): string
{
    return __DIR__;
}

function load_env_file(string $path): void
{
    if (!is_file($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        $position = strpos($trimmed, '=');
        if ($position === false) {
            continue;
        }

        $key = trim(substr($trimmed, 0, $position));
        $value = trim(substr($trimmed, $position + 1));
        $value = trim($value, "\"'");

        if ($key !== '') {
            $_ENV[$key] = $value;
            putenv(sprintf('%s=%s', $key, $value));
        }
    }
}

load_env_file(app_root_path() . DIRECTORY_SEPARATOR . '.env');

function env_value(string $key, ?string $default = null): ?string
{
    $value = $_ENV[$key] ?? getenv($key);
    if ($value === false || $value === null || $value === '') {
        return $default;
    }

    return (string) $value;
}

function database_dsn_parts(): array
{
    $databaseUrl = env_value('DATABASE_URL');
    if (!$databaseUrl) {
        throw new RuntimeException('DATABASE_URL is not configured.');
    }

    $parts = parse_url($databaseUrl);
    if ($parts === false) {
        throw new RuntimeException('DATABASE_URL is invalid.');
    }

    return [
        'host' => $parts['host'] ?? '127.0.0.1',
        'port' => (int) ($parts['port'] ?? 3306),
        'database' => isset($parts['path']) ? ltrim($parts['path'], '/') : '',
        'username' => urldecode($parts['user'] ?? ''),
        'password' => urldecode($parts['pass'] ?? ''),
    ];
}

function pdo_connection(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $parts = database_dsn_parts();
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $parts['host'],
        $parts['port'],
        $parts['database']
    );

    $pdo = new PDO(
        $dsn,
        $parts['username'],
        $parts['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    return $pdo;
}

function json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function query_value(string $key): ?string
{
    if (!isset($_GET[$key])) {
        return null;
    }

    $value = trim((string) $_GET[$key]);
    return $value === '' ? null : $value;
}

function json_response(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function error_response(string $message, int $statusCode = 400, string $code = 'request_failed'): void
{
    json_response(
        [
            'code' => $code,
            'message' => $message,
            'status' => $statusCode,
        ],
        $statusCode
    );
}

function now_string(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.u');
}

function format_datetime(DateTimeImmutable $value): string
{
    return $value->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
}

function iso_datetime_string(string $value): string
{
    try {
        $date = new DateTimeImmutable($value);
    } catch (Throwable) {
        error_response('Invalid datetime value supplied');
    }

    return format_datetime($date);
}

function iso_date_string(string $value): string
{
    try {
        $date = new DateTimeImmutable($value);
    } catch (Throwable) {
        error_response('Invalid date value supplied');
    }

    return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d');
}

function add_days(int $days): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->modify(sprintf('+%d days', $days))
        ->format('Y-m-d H:i:s.u');
}

function app_id(): string
{
    return bin2hex(random_bytes(12));
}

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string
{
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4)) ?: '';
}

function jwt_secret(string $key, string $fallback): string
{
    return env_value($key, $fallback) ?? $fallback;
}

function jwt_encode(array $payload, string $secret, string $ttl): string
{
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $issuedAt = time();
    $expiresAt = $issuedAt + ttl_to_seconds($ttl);
    $payload['iat'] = $issuedAt;
    $payload['exp'] = $expiresAt;

    $segments = [
        base64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES) ?: '{}'),
        base64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES) ?: '{}'),
    ];

    $signature = hash_hmac('sha256', implode('.', $segments), $secret, true);
    $segments[] = base64url_encode($signature);

    return implode('.', $segments);
}

function jwt_decode(string $token, string $secret): array
{
    $segments = explode('.', $token);
    if (count($segments) !== 3) {
        throw new RuntimeException('Invalid token');
    }

    [$headerEncoded, $payloadEncoded, $signatureEncoded] = $segments;
    $expected = base64url_encode(hash_hmac('sha256', $headerEncoded . '.' . $payloadEncoded, $secret, true));
    if (!hash_equals($expected, $signatureEncoded)) {
        throw new RuntimeException('Invalid token signature');
    }

    $payload = json_decode(base64url_decode($payloadEncoded), true);
    if (!is_array($payload)) {
        throw new RuntimeException('Invalid token payload');
    }

    if (($payload['exp'] ?? 0) < time()) {
        throw new RuntimeException('Token expired');
    }

    return $payload;
}

function ttl_to_seconds(string $ttl): int
{
    if (preg_match('/^(\d+)([smhd])$/', $ttl, $matches) !== 1) {
        return 900;
    }

    $value = (int) $matches[1];
    return match ($matches[2]) {
        's' => $value,
        'm' => $value * 60,
        'h' => $value * 3600,
        'd' => $value * 86400,
        default => 900,
    };
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? null;
    if (!$header || !preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        return null;
    }

    return trim($matches[1]);
}

function authenticated_user(): array
{
    $token = bearer_token();
    if (!$token) {
        error_response('Missing bearer token', 401, 'unauthorized');
    }

    try {
        return jwt_decode($token, jwt_secret('JWT_ACCESS_SECRET', 'adeyapp-dev-access-secret'));
    } catch (Throwable $exception) {
        error_response('Invalid or expired token', 401, 'unauthorized');
    }
}

function db_one(PDOStatement $statement): ?array
{
    $row = $statement->fetch();
    return $row === false ? null : $row;
}

function resolve_staff_role(PDO $pdo, string $tenantId, string $userId, ?string $branchId): string
{
    $statement = $pdo->prepare(
        'SELECT r.roleType
         FROM PermissionGrant pg
         INNER JOIN Role r ON r.id = pg.roleId
         WHERE pg.tenantId = :tenantId
           AND pg.userId = :userId
           AND pg.permissionKey = :permissionKey
           AND pg.effect = :effect
           AND (pg.branchId IS NULL OR pg.branchId = :branchId)
         ORDER BY pg.createdAt DESC
         LIMIT 1'
    );
    $statement->execute([
        'tenantId' => $tenantId,
        'userId' => $userId,
        'permissionKey' => 'workspace.access',
        'effect' => 'allow',
        'branchId' => $branchId,
    ]);

    $row = db_one($statement);
    $role = strtolower((string) ($row['roleType'] ?? 'employee'));
    return in_array($role, ['manager', 'receptionist', 'employee'], true) ? $role : 'employee';
}

function user_memberships(PDO $pdo, string $userId): array
{
    $memberships = [];

    $ownerStatement = $pdo->prepare(
        'SELECT t.id AS tenantId, t.name AS tenantName, t.slug AS tenantSlug, b.id AS branchId
         FROM Tenant t
         LEFT JOIN Branch b ON b.tenantId = t.id AND b.isDefault = 1
         WHERE t.ownerUserId = :userId
           AND t.status IN (\'trial\', \'active\', \'grace_period\')
         ORDER BY t.createdAt ASC'
    );
    $ownerStatement->execute(['userId' => $userId]);

    foreach ($ownerStatement->fetchAll() as $row) {
        $memberships[$row['tenantId']] = [
            'tenantId' => $row['tenantId'],
            'name' => $row['tenantName'],
            'slug' => $row['tenantSlug'],
            'role' => 'owner',
            'branchId' => $row['branchId'] ?: null,
            'employeeId' => null,
        ];
    }

    $employeeStatement = $pdo->prepare(
        'SELECT t.id AS tenantId, t.name AS tenantName, t.slug AS tenantSlug,
                ep.id AS employeeId, ep.primaryBranchId AS branchId, ep.employmentStatus
         FROM EmployeeProfile ep
         INNER JOIN Tenant t ON t.id = ep.tenantId
         WHERE ep.userId = :userId
           AND t.status IN (\'trial\', \'active\', \'grace_period\')
         ORDER BY ep.createdAt ASC'
    );
    $employeeStatement->execute(['userId' => $userId]);

    foreach ($employeeStatement->fetchAll() as $row) {
        if (($row['employmentStatus'] ?? null) !== 'active') {
            continue;
        }

        if (!isset($memberships[$row['tenantId']])) {
            $role = resolve_staff_role(
                $pdo,
                (string) $row['tenantId'],
                $userId,
                $row['branchId'] ?: null
            );
            $memberships[$row['tenantId']] = [
                'tenantId' => $row['tenantId'],
                'name' => $row['tenantName'],
                'slug' => $row['tenantSlug'],
                'role' => $role,
                'branchId' => $row['branchId'] ?: null,
                'employeeId' => $row['employeeId'],
            ];
        }
    }

    $customerStatement = $pdo->prepare(
        'SELECT t.id AS tenantId, t.name AS tenantName, t.slug AS tenantSlug,
                cp.id AS customerId, cp.primaryBranchId AS branchId
         FROM CustomerProfile cp
         INNER JOIN Tenant t ON t.id = cp.tenantId
         WHERE cp.userId = :userId
           AND t.status IN (\'trial\', \'active\', \'grace_period\')
         ORDER BY cp.createdAt ASC'
    );
    $customerStatement->execute(['userId' => $userId]);

    foreach ($customerStatement->fetchAll() as $row) {
        if (!isset($memberships[$row['tenantId']])) {
            $memberships[$row['tenantId']] = [
                'tenantId' => $row['tenantId'],
                'name' => $row['tenantName'],
                'slug' => $row['tenantSlug'],
                'role' => 'customer',
                'branchId' => $row['branchId'] ?: null,
                'employeeId' => null,
            ];
        }
    }

    return array_values($memberships);
}

function build_session(PDO $pdo, string $userId, string $email, ?string $tenantSelector = null): array
{
    $userStatement = $pdo->prepare('SELECT isPlatformUser FROM User WHERE id = :id LIMIT 1');
    $userStatement->execute(['id' => $userId]);
    $user = db_one($userStatement);
    $isPlatformUser = !empty($user['isPlatformUser']);

    $tenants = user_memberships($pdo, $userId);

    $selectedTenant = null;
    if ($tenantSelector !== null) {
        foreach ($tenants as $tenant) {
            if ($tenant['slug'] === $tenantSelector || $tenant['tenantId'] === $tenantSelector) {
                $selectedTenant = $tenant;
                break;
            }
        }
    }
    if ($selectedTenant === null && count($tenants) > 0) {
        $selectedTenant = $tenants[0];
    }

    $role = $selectedTenant['role'] ?? ($isPlatformUser ? 'superadmin' : 'platform_user');
    $accessToken = jwt_encode(
        [
            'sub' => $userId,
            'email' => $email,
            'role' => $role,
            'tenantId' => $selectedTenant['tenantId'] ?? null,
            'branchId' => $selectedTenant['branchId'] ?? null,
            'employeeId' => $selectedTenant['employeeId'] ?? null,
        ],
        jwt_secret('JWT_ACCESS_SECRET', 'adeyapp-dev-access-secret'),
        env_value('JWT_ACCESS_TTL', '15m') ?? '15m'
    );

    $refreshToken = jwt_encode(
        [
            'sub' => $userId,
            'email' => $email,
            'role' => $role,
        ],
        jwt_secret('JWT_REFRESH_SECRET', 'adeyapp-dev-refresh-secret'),
        env_value('JWT_REFRESH_TTL', '30d') ?? '30d'
    );

    return [
        'accessToken' => $accessToken,
        'refreshToken' => $refreshToken,
        'user' => [
            'id' => $userId,
            'email' => $email,
        ],
        'context' => $selectedTenant ? [
            'tenantId' => $selectedTenant['tenantId'],
            'branchId' => $selectedTenant['branchId'] ?: null,
            'employeeId' => $selectedTenant['employeeId'] ?: null,
            'role' => $selectedTenant['role'],
        ] : null,
        'tenants' => array_map(
            static fn (array $tenant): array => [
                'id' => $tenant['tenantId'],
                'name' => $tenant['name'],
                'slug' => $tenant['slug'],
                'role' => $tenant['role'],
                'branchIds' => array_values(array_filter([$tenant['branchId'] ?? null])),
            ],
            $tenants
        ),
    ];
}

function require_superadmin(PDO $pdo, array $authUser): array
{
    $role = strtolower((string) ($authUser['role'] ?? ''));
    if (!in_array($role, ['superadmin', 'superadmin_support', 'superadmin_finance'], true)) {
        error_response('Superadmin authentication is required', 401, 'unauthorized');
    }

    $statement = $pdo->prepare(
        'SELECT id, email
         FROM User
         WHERE id = :id
           AND isPlatformUser = 1
           AND status = :status
         LIMIT 1'
    );
    $statement->execute([
        'id' => $authUser['sub'] ?? '',
        'status' => 'active',
    ]);
    $user = db_one($statement);
    if (!$user) {
        error_response('Superadmin account not available', 403, 'forbidden');
    }

    return [
        'userId' => $user['id'],
        'email' => $user['email'],
        'role' => $role,
    ];
}

function require_workspace_roles(array $authUser, array $allowedRoles, string $message = 'Workspace context is required'): array
{
    $role = strtolower((string) ($authUser['role'] ?? ''));
    if (!in_array($role, $allowedRoles, true) || empty($authUser['tenantId'])) {
        error_response($message, 401, 'unauthorized');
    }

    return [
        'tenantId' => $authUser['tenantId'],
        'branchId' => $authUser['branchId'] ?? null,
        'userId' => $authUser['sub'],
        'email' => $authUser['email'],
        'role' => $role,
        'employeeId' => $authUser['employeeId'] ?? null,
    ];
}

function require_owner_workspace(array $authUser): array
{
    return require_workspace_roles($authUser, ['owner'], 'Owner workspace context is required');
}

function require_management_workspace(array $authUser): array
{
    return require_workspace_roles($authUser, ['owner', 'manager'], 'Owner or manager workspace context is required');
}

function require_frontdesk_workspace(array $authUser): array
{
    return require_workspace_roles($authUser, ['owner', 'manager', 'receptionist'], 'Front desk workspace context is required');
}

function require_employee_workspace(array $authUser): array
{
    if (($authUser['role'] ?? null) !== 'employee' || empty($authUser['tenantId']) || empty($authUser['employeeId'])) {
        error_response('Employee workspace context is required', 401, 'unauthorized');
    }

    return [
        'tenantId' => $authUser['tenantId'],
        'branchId' => $authUser['branchId'] ?? null,
        'employeeId' => $authUser['employeeId'],
        'userId' => $authUser['sub'],
        'email' => $authUser['email'],
    ];
}

function require_customer_workspace(array $authUser): array
{
    return require_workspace_roles($authUser, ['customer'], 'Customer workspace context is required');
}

function approved_networks_from_branch(?string $approvedNetworksJson): array
{
    if (!$approvedNetworksJson) {
        return [];
    }

    $decoded = json_decode($approvedNetworksJson, true);
    if (!is_array($decoded)) {
        return [];
    }

    return array_values(array_filter(array_map(
        static fn ($value): string => trim((string) $value),
        $decoded
    )));
}
