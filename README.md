![License](https://img.shields.io/badge/license-MIT-blue.svg)

# RepoLens

AI-powered panoramic code analysis tool — instantly understand the architectural core of any project.

RepoLens analyzes code repositories using AI agents to generate interactive Mermaid architecture diagrams. It supports multiple data sources: GitHub URLs, local paths, and ZIP uploads.

> [繁體中文版](./README.zh-TW.md)

## Features

- **AI Agent Architecture Analysis**: Multi-step agent pipeline with tool calling to analyze repo structure, generate architecture explanations, and produce interactive diagrams
- **Multiple Data Sources**: GitHub repositories (public & private), local file paths, ZIP file uploads
- **Interactive Diagrams**: Click on nodes to navigate to source files; zoom, pan, and export as PNG or Mermaid code
- **Multi-Provider LLM Support**: OpenAI, Anthropic, Google, Azure — configurable per deployment
- **Self-Hosted**: Single-binary Node.js deployment with SQLite, no external services required
- **i18n**: English and Traditional Chinese (next-intl)
- **Auth**: Built-in password-based authentication with encrypted API key storage

## Tech Stack

- **Framework**: Next.js 16, React 19, TypeScript 6
- **Styling**: Tailwind CSS 4, ShadCN, Radix UI
- **Database**: SQLite (better-sqlite3) + Drizzle ORM
- **AI**: Vercel AI SDK v6 (streamText + tool calling)
- **Diagrams**: Mermaid + @mermaid-js/layout-elk
- **Deployment**: Node.js standalone (e.g. BaoTa panel)

## Quick Start

1. Clone and install

```bash
git clone https://github.com/Minidoracat/repolens.git
cd repolens
pnpm install
```

2. Configure environment

```bash
cp .env.example .env
```

Set at minimum:
- `ENCRYPTION_KEY` — generate with `openssl rand -hex 32`

3. Run development server

```bash
pnpm dev
```

4. Open `http://localhost:3000`, complete the setup wizard (set password + LLM provider config)

## Environment Variables

See [`.env.example`](./.env.example) for all options. Key variables:

| Variable | Description |
|----------|-------------|
| `ENCRYPTION_KEY` | Required. AES key for encrypting API keys in DB |
| `PORT` | Server port (default: 3000) |
| `DATA_DIR` | Data directory (default: ./data) |
| `ALLOWED_LOCAL_PATHS` | Comma-separated whitelist for local path analysis |

LLM provider settings are configured through the web UI after initial setup.

## Project Structure

```
src/
  app/
    (public)/          # Login, setup wizard
    (protected)/       # Main workspace (requires auth)
    api/               # REST endpoints (auth, projects, runs, settings, setup)
  server/
    agent/             # AI agent runtime, prompts, LLM factory, tools
    auth/              # Session & password authentication
    db/                # SQLite schema, queries, client
    sources/           # Data source adapters (GitHub, local, ZIP)
    security/          # Encryption, HKDF key derivation
  components/          # React components (workspace, settings, UI)
  i18n/                # Internationalization messages
  features/runs/       # Run management logic
  lib/                 # Shared utilities
  hooks/               # React hooks (useAgentStream, etc.)
```

## Development

```bash
pnpm dev          # Start dev server with Turbopack
pnpm check        # Lint + typecheck
pnpm test         # Run Vitest tests
pnpm build        # Production build
pnpm db:studio    # Drizzle Studio (DB browser)
```

## Deployment

RepoLens builds as a Next.js standalone output. See [`scripts/deploy-baota.sh`](./scripts/deploy-baota.sh) for a BaoTa panel deployment example.

## License

MIT

## Acknowledgements

Originally forked from [GitDiagram](https://github.com/ahmedkhaleel2004/gitdiagram) by Ahmed Khaleel. RepoLens is a complete rewrite with a different architecture and feature set.
