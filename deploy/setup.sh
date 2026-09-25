#!/usr/bin/env bash
# Установка Fermer на чистый сервер Ubuntu 22.04/24.04 (Timeweb Cloud, Selectel и т. п.).
# Запуск от root:  bash setup.sh
# Повторный запуск обновляет приложение до последней версии из GitHub.
set -euo pipefail

REPO="${REPO:-https://github.com/vladicgall-ux/Fermer.git}"
BRANCH="${BRANCH:-main}"
DIR=/opt/fermer

echo "==> Пакеты и Docker"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl git
  curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null 2>&1 || { apt-get update -y && apt-get install -y git; }

# Сборке Next.js нужно ~2 ГБ памяти: на маленьких тарифах добавляем swap.
if ! swapon --show | grep -q .; then
  echo "==> Swap 2 ГБ"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Код приложения"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --depth 1 origin "$BRANCH" && git -C "$DIR" reset --hard "origin/$BRANCH"
else
  # Для приватного репозитория: REPO=https://<token>@github.com/vladicgall-ux/Fermer.git bash setup.sh
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$DIR"
fi

cd "$DIR/deploy"
if [ ! -f .env ]; then
  cp .env.example .env
  echo
  echo "!!! Заполните $DIR/deploy/.env (DOMAIN, TELEGRAM_BOT_TOKEN, DATABASE_URL, ADMIN_TELEGRAM_IDS)"
  echo "!!! и запустите скрипт ещё раз:  bash $DIR/deploy/setup.sh"
  exit 1
fi

echo "==> Сборка и запуск"
docker compose up -d --build
docker image prune -f >/dev/null

echo
echo "Готово. Проверка: https://$(grep '^DOMAIN=' .env | cut -d= -f2)"
