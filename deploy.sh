#!/usr/bin/env bash
# Выкладка eKor web: сборка образа здесь → перенос по SSH → перезапуск контейнера на сервере.
#   ./deploy.sh            — собрать текущий коммит и выложить
#   ./deploy.sh rollback   — вернуть предыдущую версию
set -euo pipefail

HOST="${DEPLOY_HOST:-babilon@192.168.77.251}"
BIND="${DEPLOY_BIND:-10.154.13.251:7788}"   # адрес:порт на сервере
NAME=ekor-web
TAG="$(git rev-parse --short HEAD)$(git diff --quiet || echo -dirty)"

if [[ "${1:-}" == "rollback" ]]; then
  ssh "$HOST" "set -e; PREV=\$(docker inspect -f '{{.Config.Image}}' $NAME-prev 2>/dev/null || true)
    [ -n \"\$PREV\" ] || { echo 'Нет предыдущей версии'; exit 1; }
    docker rm -f $NAME >/dev/null; docker rename $NAME-prev $NAME; docker start $NAME >/dev/null; echo \"Откат на \$PREV\""
  exit
fi

echo "▸ Сборка ekor-web:$TAG"
docker build -t "$NAME:$TAG" -t "$NAME:latest" \
  --build-arg NEXT_PUBLIC_SMS_ENABLED="${NEXT_PUBLIC_SMS_ENABLED:-false}" \
  --build-arg NEXT_PUBLIC_TEST_OTP="${NEXT_PUBLIC_TEST_OTP:-123456}" \
  --build-arg NEXT_PUBLIC_API="${NEXT_PUBLIC_API:-mock}" \
  --build-arg API_ORIGIN="${API_ORIGIN:-https://lab.tcell.tj}" .

echo "▸ Перенос образа на $HOST"
docker save "$NAME:$TAG" | gzip -1 | ssh "$HOST" 'gunzip | docker load'

echo "▸ Перезапуск контейнера ($BIND)"
ssh "$HOST" "set -e
  docker rm -f $NAME-prev >/dev/null 2>&1 || true
  if docker inspect $NAME >/dev/null 2>&1; then docker stop $NAME >/dev/null; docker rename $NAME $NAME-prev; fi
  docker run -d --name $NAME --restart unless-stopped -p $BIND:3000 \
    --memory 512m --log-opt max-size=10m --log-opt max-file=3 $NAME:$TAG >/dev/null
  for i in \$(seq 1 30); do
    curl -fs -o /dev/null http://$BIND/ && { echo \"✓ ekor-web:$TAG работает: http://$BIND\"; exit 0; }
    sleep 1
  done
  echo '✗ Не поднялся — возвращаю предыдущую версию'; docker logs --tail 50 $NAME
  docker rm -f $NAME >/dev/null
  if docker inspect $NAME-prev >/dev/null 2>&1; then docker rename $NAME-prev $NAME; docker start $NAME >/dev/null; fi
  exit 1"
