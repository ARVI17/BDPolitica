#!/bin/sh
set -eu

DB_HOST="${DB_HOST:-postgres}"
DB_NAME="${DB_NAME:-bdpolitica}"
DB_USER="${DB_USER:-bdpolitica}"
DB_PASSWORD="${DB_PASSWORD:-bdpolitica_dev}"

export PGPASSWORD="$DB_PASSWORD"

echo "Verificando si la base ya fue inicializada..."
IS_READY="$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT to_regclass('public.tenants') IS NOT NULL;")"

if [ "$IS_READY" = "t" ]; then
  echo "La base ya tiene esquema. Omitiendo creacion de esquema."
else
  echo "Aplicando esquema SQL..."
  psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f /workspace/docs/03-modelo-datos.sql
fi

echo "Aplicando seed SQL..."
psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f /workspace/apps/api/prisma/seed.sql

echo "Inicializacion completada."
