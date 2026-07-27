# Contributing to Kafka Offset Harbor

Thanks for your interest in contributing! This project is a cross-platform
Electron desktop app for exploring Apache Kafka. Bug reports, feature ideas, and
pull requests are all welcome.

## Ways to contribute

- **Report a bug** — open a [Bug report](../../issues/new?template=bug_report.md).
- **Request a feature** — open a [Feature request](../../issues/new?template=feature_request.md).
- **Improve docs** — typos, clarifications and examples are great first PRs.
- **Fix or build something** — pick an open issue, or propose your idea in one
  before starting large work so we can align on direction.

## Development setup

Requirements: **Node.js 24+** and npm. macOS or Windows for building native
installers; Linux works for development.

```bash
git clone https://github.com/rajeshkumaravel/kafka-offset-harbor.git
cd kafka-offset-harbor
npm install
npm run dev          # launch the app with hot reload
```

No Kafka broker required — the app ships with a built-in **demo cluster**. To
test against a real broker, spin up the local one in [`docker/`](docker/):

```bash
docker build -t koh-kafka:local docker/
docker run -d --name koh-kafka -p 9092:9092 koh-kafka:local
./docker/seed.sh
```

## Before you open a PR

Please make sure the checks that CI runs pass locally:

```bash
npm run typecheck    # type-checks both the main and renderer processes
npx electron-vite build   # confirms the app bundles
```

If your change affects the UI or a Kafka flow, exercise it in the running app
(the demo cluster or the local Docker broker) and mention what you verified in
the PR description.

## Pull request guidelines

- Keep PRs focused — one logical change per PR.
- Match the existing code style (TypeScript, functional React components,
  Zustand for state). No new linters or formatters in a feature PR, please.
- Update docs (`README.md`, in-app Help) when you change user-facing behaviour.
- Reference the issue your PR addresses (e.g. `Closes #123`).
- Describe **what** changed and **how you tested it**.

## Project layout

See the **Layout** section of the [README](README.md#layout) for a map of the
`src/` tree. In short:

- `src/main` — Electron main process: Kafka adapters, SQLite store, IPC handlers.
- `src/preload` — the single typed `invoke` bridge.
- `src/renderer` — the React UI and Zustand store.
- `src/shared` — types and the IPC contract shared across processes.

## Reporting security issues

Please **do not** open a public issue for security-sensitive reports. Instead,
contact the maintainers privately (see the repository's Security policy or
contact address) so the issue can be addressed before disclosure.

## Code of Conduct

Be respectful and constructive. Harassment or abusive behaviour won't be
tolerated in issues, PRs, or any project space.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
