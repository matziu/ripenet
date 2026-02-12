#!/bin/bash
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Ensuring admin superuser exists..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@ripenet.local', 'admin', role='admin')
    print('Created admin user')
else:
    print('Admin user already exists')
"

echo "Loading seed data if needed..."
python manage.py shell < /app/seed_data.py

exec "$@"
