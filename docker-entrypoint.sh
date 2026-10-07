#!/bin/sh
set -eu

# Docker secrets are files. Convert them to connection URLs inside the
# running container so passwords never need to be committed or logged.
if [ -z "${MONGO_DB_URL:-}" ] && [ -n "${MONGO_PASSWORD_FILE:-}" ]; then
  mongo_password="$(cat "$MONGO_PASSWORD_FILE")"
  mongo_password_encoded="$(node -p 'encodeURIComponent(process.argv[1])' "$mongo_password")"
  export MONGO_DB_URL="mongodb://${MONGO_USERNAME}:${mongo_password_encoded}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}?authSource=admin"
fi

if [ -z "${REDIS_URL:-}" ] && [ -n "${REDIS_PASSWORD_FILE:-}" ]; then
  redis_password="$(cat "$REDIS_PASSWORD_FILE")"
  redis_password_encoded="$(node -p 'encodeURIComponent(process.argv[1])' "$redis_password")"
  export REDIS_URL="redis://:${redis_password_encoded}@redis:6379"
fi

exec "$@"
