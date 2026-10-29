#!/usr/bin/env bash
# Выкладка eKor web: исходники по rsync на сервер → сборка образа там → перезапуск контейнера.
#   ./deploy.sh            — выложить текущий коммит
#   ./deploy.sh rollback   — вернуть предыдущую версию
set -euo pipefail
cd "$(dirname "$0")"

HOST="${DEPLOY_HOST:-bbs@100.81.2.104}"
BIND="${DEPLOY_BIND:-7788}"          # [адрес:]порт на сервере
DIR="${DEPLOY_DIR:-ekor-web}"        # папка с исходниками на сервере (от ~)
NAME=ekor-web
TAG="$(git rev-parse --short HEAD)$(git diff --quiet || echo -dirty)"
CHECK="http://127.0.0.1:${BIND##*:}/"

if [[ "${1:-}" == "rollback" ]]; then
  ssh "$HOST" "set -e; PREV=\$(docker container inspect -f '{{.Config.Image}}' $NAME-prev 2>/dev/null || true)
    [ -n \"\$PREV\" ] || { echo 'Нет предыдущей версии'; exit 1; }
    docker rm -f $NAME >/dev/null; docker rename $NAME-prev $NAME; docker start $NAME >/dev/null; echo \"Откат на \$PREV\""
  exit
fi

echo "▸ Исходники → $HOST:~/$DIR"
rsync -az --delete --exclude node_modules --exclude .next --exclude .git --exclude '*.tsbuildinfo' ./ "$HOST:$DIR/"

echo "▸ Сборка ekor-web:$TAG на сервере"
ssh "$HOST" "set -e; cd $DIR
  docker build -q -t $NAME:$TAG -t $NAME:latest \
    --build-arg NEXT_PUBLIC_SMS_ENABLED=${NEXT_PUBLIC_SMS_ENABLED:-false} \
    --build-arg NEXT_PUBLIC_TEST_OTP=${NEXT_PUBLIC_TEST_OTP:-123456} \
    --build-arg NEXT_PUBLIC_API=${NEXT_PUBLIC_API:-real} \
    --build-arg API_ORIGIN=${API_ORIGIN:-https://lab.tcell.tj} . >/dev/null"

echo "▸ Перезапуск контейнера ($BIND)"
ssh "$HOST" "set -e
  docker rm -f $NAME-prev >/dev/null 2>&1 || true
  if docker container inspect $NAME >/dev/null 2>&1; then docker stop $NAME >/dev/null; docker rename $NAME $NAME-prev; fi
  docker run -d --name $NAME --restart unless-stopped -p $BIND:3000 \
    --memory 512m --log-opt max-size=10m --log-opt max-file=3 $NAME:$TAG >/dev/null
  for i in \$(seq 1 30); do
    curl -fs -o /dev/null $CHECK && { echo \"✓ ekor-web:$TAG работает: $HOST порт ${BIND##*:}\"; exit 0; }
    sleep 1
  done
  echo '✗ Не поднялся — возвращаю предыдущую версию'; docker logs --tail 50 $NAME
  docker rm -f $NAME >/dev/null
  if docker container inspect $NAME-prev >/dev/null 2>&1; then docker rename $NAME-prev $NAME; docker start $NAME >/dev/null; fi
  exit 1"
# Старые образы, кроме текущего и предыдущего, не копим
ssh "$HOST" "docker image prune -f >/dev/null; docker images $NAME --format '{{.Tag}}' | grep -v -e latest -e $TAG | tail -n +2 | xargs -r -I{} docker rmi $NAME:{} >/dev/null 2>&1 || true"
