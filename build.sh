#!/usr/bin/env bash
set -o errexit

# Install Python deps
pip install -r requirements.txt

# Build React frontend
cd frontend
npm install
npm run build
cd ..

# Collect static files
python manage.py collectstatic --no-input

# Run migrations
python manage.py migrate

# Seed data (idempotent — only creates if not exists)
python manage.py seed
