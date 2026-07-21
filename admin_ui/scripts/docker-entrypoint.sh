#!/bin/sh
set -e

if [ "${RUN_PLATFORM_SETUP:-false}" = "true" ]; then
  echo "Running platform migrations..."
  node scripts/platform-setup.mjs
fi

exec "$@"
