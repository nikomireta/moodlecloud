FROM php:8.3-fpm-bookworm

ARG MOODLE_DOWNLOAD_URL=https://download.moodle.org/download.php/direct/stable501/moodle-latest-501.tgz

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      gettext-base \
      libfreetype6-dev \
      libicu-dev \
      libjpeg62-turbo-dev \
      libpng-dev \
      libpq-dev \
      libxml2-dev \
      libzip-dev \
      nginx \
      unzip && \
    docker-php-ext-configure gd --with-freetype --with-jpeg && \
    docker-php-ext-install -j"$(nproc)" exif gd intl opcache pdo_pgsql pgsql soap zip && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/www/html /var/www/moodledata /run/php && \
    curl -fsSL "$MOODLE_DOWNLOAD_URL" -o /tmp/moodle.tgz && \
    tar -xzf /tmp/moodle.tgz --strip-components=1 -C /var/www/html && \
    rm -f /tmp/moodle.tgz && \
    chown -R www-data:www-data /var/www/html /var/www/moodledata

COPY files/config.php.template /opt/moodle/config.php.template
COPY files/php.ini /usr/local/etc/php/conf.d/moodle.ini
COPY files/nginx.conf /etc/nginx/nginx.conf
COPY files/moodle.conf /etc/nginx/conf.d/default.conf
COPY files/render-config.sh /usr/local/bin/render-config.sh
COPY files/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY files/cron.sh /usr/local/bin/cron.sh

RUN chmod +x /usr/local/bin/render-config.sh /usr/local/bin/entrypoint.sh /usr/local/bin/cron.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 CMD curl -fsS http://127.0.0.1/ >/dev/null || exit 1

CMD ["/usr/local/bin/entrypoint.sh"]
