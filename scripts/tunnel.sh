#!/usr/bin/env bash
# Opens an SSH tunnel: homedev:5432 → localhost:5433
# Use this to run migrations without starting the app (e.g. npm run migrate).
# For normal local development, use: npm run start:local  (starts tunnel + server together)
# Press Ctrl+C to close.
echo "Tunnel: localhost:5433 → kim@homedev:5432  (Ctrl+C to close)"
ssh -N -L 5433:localhost:5432 kim@homedev
