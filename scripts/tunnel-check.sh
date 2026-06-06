#!/bin/bash
# Script to check SSH tunnel status (localhost:5433 -> homedev:5432)
echo "Checking connectivity to localhost:5433..."
if nc -z localhost 5433; then
    echo "✅ Tunnel alive."
else
    echo "❌ Tunnel appears inactive. Attempting reconnection..."
    # Kill any existing tunnel process on port 5432 (PostgreSQL) if it exists
    pkill -f "5433:localhost:5432" 2>/dev/null
    sleep 1
    # Start a new background SSH tunnel connection
    ssh -N -L 5433:localhost:5432 kim@homedev &
    echo "Attempting to restart tunnel in background. Check connectivity shortly."
fi