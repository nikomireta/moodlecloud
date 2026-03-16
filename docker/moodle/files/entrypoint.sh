#!/bin/sh
set -eu

/usr/local/bin/render-config.sh

php-fpm -D
exec nginx -g 'daemon off;'
