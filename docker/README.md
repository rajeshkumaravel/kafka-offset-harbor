# Local Kafka for testing

A single-node Kafka broker (KRaft mode — no ZooKeeper) that advertises
`localhost:9092`, plus a seed script that fills it with sample data.

## 1. Build

```bash
docker build -t koh-kafka:local docker/
```

## 2. Run

```bash
docker run -d --name koh-kafka -p 9092:9092 koh-kafka:local
```

Give it ~5–8 seconds to elect its controller. Check it's up:

```bash
docker exec koh-kafka /opt/kafka/bin/kafka-broker-api-versions.sh \
  --bootstrap-server localhost:9092 >/dev/null && echo ready
```

## 3. Seed sample data

```bash
./docker/seed.sh              # defaults to container name "koh-kafka"
# or: ./docker/seed.sh my-container
```

This creates:

- **`orders.created`** — 3 partitions, 60 JSON messages (keyed by `order-N`)
- **`app.logs`** — 2 partitions, 40 plain-text log lines
- **`order-processor`** — a consumer group that consumed 30 of the 60 orders,
  leaving **~30 messages of lag** across partitions

It prints the resulting lag so you can compare it against the app's
consumer-group view.

## 4. Connect the app

In Kafka Offset Harbor → **Connections → + New connection**:

| Field             | Value            |
|-------------------|------------------|
| Name              | Local Docker     |
| Bootstrap servers | `localhost:9092` |
| Security protocol | `PLAINTEXT`      |

**Test connection** should report `connected — 1 broker`. Save, select it,
and the tree fills with the seeded topics and group.

## 5. Things to try

- Open **`orders.created`** → *Messages* → **Fetch** (newest / oldest / offset / time).
- Select a message → inspect the pretty-printed JSON, headers, and hex view.
- Open **`order-processor`** → see per-partition lag; **Reset offsets…** to
  earliest, then re-check lag in a terminal:
  ```bash
  docker exec koh-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
    --bootstrap-server localhost:9092 --describe --group order-processor
  ```
- **Produce…** a message to a topic and watch the partition end-offset grow.

## Tear down

```bash
docker rm -f koh-kafka
```

## Notes

- **Auth:** this image is PLAINTEXT-only, for local dev. The app also supports
  SSL/TLS, SASL PLAIN/SCRAM, and AWS MSK IAM against real clusters — those
  paths aren't exercised by this container.
- **Persistence:** none configured; data lives in the container's ephemeral
  layer and is gone on `docker rm`. That's intentional for a scratch broker —
  add a `-v` mount on `/var/lib/kafka/data` if you want it to survive restarts.
