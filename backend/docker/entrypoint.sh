#!/bin/sh
set -e

echo "Aguardando MySQL em ${DB_HOST:-mysql}..."
i=0
until php -r "
\$host = getenv('DB_HOST') ?: 'mysql';
\$db = getenv('DB_DATABASE') ?: 'gfc';
\$user = getenv('DB_USERNAME') ?: 'root';
\$pass = getenv('DB_PASSWORD') ?: 'secret';
new PDO('mysql:host=' . \$host . ';port=3306;dbname=' . \$db, \$user, \$pass);
" >/dev/null 2>&1; do
  i=$((i+1))
  if [ "$i" -gt 40 ]; then
    echo "MySQL não respondeu a tempo."
    exit 1
  fi
  sleep 2
done

if [ ! -f vendor/autoload.php ]; then
  composer install --no-interaction --prefer-dist
fi

php artisan config:clear
php artisan migrate --force

php artisan db:seed --force || true

chown -R www-data:www-data storage bootstrap/cache || true

exec docker-php-entrypoint "$@"
