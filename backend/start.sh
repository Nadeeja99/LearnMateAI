#!/bin/bash

# Production startup script for LearnMate AI Backend

echo "Starting LearnMate AI Backend..."

# Create data directory if it doesn't exist
mkdir -p data

# Set Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Start the application
exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
