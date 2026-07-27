#!/usr/bin/env bash
# Seed a running Kafka broker with sample topics, messages, and a lagging
# consumer group — enough to exercise every screen in Kafka Offset Harbor.
#
# Usage:  docker/seed.sh [container-name]   (default: koh-kafka)
set -euo pipefail

CONTAINER="${1:-koh-kafka}"
BROKER="localhost:9092"
K=/opt/kafka/bin

run() { docker exec "$CONTAINER" "$@"; }

echo "⏳ waiting for broker in '$CONTAINER'…"
for i in $(seq 1 30); do
  if run "$K/kafka-broker-api-versions.sh" --bootstrap-server "$BROKER" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  [ "$i" = 30 ] && { echo "broker never became ready"; exit 1; }
done

echo "📁 creating topics…"
run "$K/kafka-topics.sh" --bootstrap-server "$BROKER" --create --if-not-exists \
  --topic orders.created --partitions 3 --replication-factor 1 >/dev/null
run "$K/kafka-topics.sh" --bootstrap-server "$BROKER" --create --if-not-exists \
  --topic app.logs --partitions 2 --replication-factor 1 >/dev/null

echo "✉️  producing messages…"
run bash -c 'for i in $(seq 1 60); do
    echo "order-$i:{\"orderId\":$i,\"item\":\"widget-$((i%5))\",\"qty\":$((i%3+1))}"
  done | '"$K"'/kafka-console-producer.sh --bootstrap-server '"$BROKER"' \
    --topic orders.created --property parse.key=true --property key.separator=:'
run bash -c 'for i in $(seq 1 40); do
    echo "INFO request $i completed in ${i}ms"
  done | '"$K"'/kafka-console-producer.sh --bootstrap-server '"$BROKER"' --topic app.logs'

echo "🐌 creating a consumer group with lag (consumes 30 of 60)…"
run bash -c 'timeout 12 '"$K"'/kafka-console-consumer.sh --bootstrap-server '"$BROKER"' \
  --topic orders.created --group order-processor --max-messages 30 --from-beginning \
  >/dev/null 2>&1 || true'

echo
echo "✅ done. Consumer group lag:"
run "$K/kafka-consumer-groups.sh" --bootstrap-server "$BROKER" --describe --group order-processor 2>/dev/null || true
echo
echo "Connect the app to a PLAINTEXT cluster at localhost:9092."
