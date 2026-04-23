# PHP Backend

This backend exists because the deploy target is shared cPanel hosting with PHP/MySQL support and no Node runtime.

Local run option:

```powershell
php -S 127.0.0.1:8080 -t backend/public backend/public/router.php
```

Primary API base URL locally:

`http://127.0.0.1:8080`

Primary API base URL on cPanel:

- Point a subdomain or folder to `backend/public`
- Ensure Apache rewrite rules are enabled so `.htaccess` forwards requests to `index.php`

Implemented endpoints:

- `GET /api/v1/health`
- `POST /api/v1/auth/register-owner`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/select-tenant`
- `GET /api/v1/tenant-management/workspaces`
- `POST /api/v1/tenant-management/workspaces`
- `GET /api/v1/tenant-management/branches`
- `POST /api/v1/tenant-management/rooms`
- `POST /api/v1/tenant-management/services`
