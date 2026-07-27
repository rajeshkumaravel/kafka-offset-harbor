# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.
Instead, use GitHub's private reporting: **Security → Report a vulnerability**
on the repository. You'll get an acknowledgement within a few days.

## Scope

Kafka Offset Harbor runs entirely on your machine. Reports we care most about:

- Any way the renderer (UI) process can reach stored credentials
- Any outbound network connection other than user-configured brokers
  (and AWS STS when MSK IAM is enabled)
- Credential material written to disk unencrypted
- Escalation via the IPC bridge (`src/shared/ipc.ts` contract)

## Supported versions

Only the latest release receives security fixes.
