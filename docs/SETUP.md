# LandlordGuru — Setup Guide

## Architecture

```
Browser (any device)
    ↕  HTTPS
homedev  (nginx reverse proxy)
    ↕
Node.js / Express  (serves frontend + REST API)
    ↕
PostgreSQL  (landlordguru_prod)
```

Google is used only for login (OAuth2). There is no Google Sheets dependency.

---

## Environments

| Environment | Host | Database | Port |
|-------------|------|----------|------|
| Local dev | your machine (tunnel to homedev) | `landlordguru_dev` | 3000 |
| Test | `homedev` | `landlordguru_test` | 3001 |
| Production | `homedev` | `landlordguru_prod` | 3002 |

---

## Full setup guide

See **[docs/BACKEND-SETUP.md](BACKEND-SETUP.md)** for step-by-step instructions covering:

- Cloning the repo and installing dependencies
- Configuring the `.env` file
- Opening the SSH tunnel to homedev
- Running database migrations
- Setting up Google OAuth credentials
- Deploying to test and production
- Troubleshooting common errors
