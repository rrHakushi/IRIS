# Nestia Skill

A professional [Claude Skill](https://www.anthropic.com/news/agent-skills) for building, configuring, and shipping NestJS backends with [Nestia](https://nestia.io/) — covering `@nestia/core` super-fast typed decorators, `@nestia/sdk` for type-safe SDK and Swagger generation, the mockup simulator, automatic E2E test generation, and the [`@agentica`](https://github.com/wrtnlabs/agentica) AI chatbot integration.

> **What this is:** instructions Claude can load when a user asks for help with Nestia — covering setup, the decorator API, SDK/Swagger generation, E2E testing, agentic AI integration, and the most common failure modes — plus ready-to-use templates and a worked example.

> **What this is not:** a fork or a wrapper around Nestia itself. The Nestia source lives at [`samchon/nestia`](https://github.com/samchon/nestia). This skill is reference material *about* Nestia.

## Coverage

This skill covers Nestia as of **April 2026** (`@nestia/core` and `@nestia/sdk` 11.x, `nestia` CLI 10.x). It includes:

| Area | Reference file |
|---|---|
| Setup — wizard, manual, NX, webpack, single-JS-file bundling | [`references/setup.md`](references/setup.md) |
| Decorator API — `@TypedRoute`, `@TypedBody`, `@TypedQuery`, `@TypedParam`, `@TypedHeaders`, `@TypedFormData`, `@TypedException`, `@WebSocketRoute` | [`references/core-decorators.md`](references/core-decorators.md) |
| SDK generation — full `INestiaConfig` schema, clone/propagate/simulate modes, distribution | [`references/sdk-generation.md`](references/sdk-generation.md) |
| Swagger generation — offline + runtime composition, JSDoc-driven docs, security schemes, OpenAPI version downgrade | [`references/swagger-generation.md`](references/swagger-generation.md) |
| E2E testing — auto-generated test scaffolds, `TestValidator`, `DynamicExecutor`, `@nestia/benchmark` | [`references/e2e-testing.md`](references/e2e-testing.md) |
| Agentic AI — `@agentica/core`, validation feedback, WebSocket chatbot pattern | [`references/agentic-ai.md`](references/agentic-ai.md) |
| Troubleshooting — every common "it silently no-ops" failure mode and how to diagnose it | [`references/troubleshooting.md`](references/troubleshooting.md) |

## Repository layout

```
nestia-skill/
├── SKILL.md                              # main skill file (loaded by Claude when triggered)
├── README.md                             # this file
├── LICENSE                               # MIT
├── .gitignore
├── references/                           # detailed docs loaded on demand
│   ├── setup.md
│   ├── core-decorators.md
│   ├── sdk-generation.md
│   ├── swagger-generation.md
│   ├── e2e-testing.md
│   ├── agentic-ai.md
│   └── troubleshooting.md
├── assets/                               # ready-to-use templates
│   ├── nestia.config.template.ts
│   ├── tsconfig.template.json
│   └── package.scripts.json
└── examples/
    └── bbs-controller/                   # complete CRUD controller demo
        ├── README.md
        ├── IBbsArticle.ts
        ├── BbsArticlesController.ts
        └── BbsArticlesService.ts
```

## Installation

The skill works in any environment that supports Anthropic Skills (Claude Code, Claude API with the skills beta, Claude.ai with skill upload, etc.). Install in whichever way your environment expects:

### Option A — Claude Code

```bash
git clone https://github.com/<your-username>/nestia-skill.git ~/.claude/skills/nestia
```

Then start a Claude Code session in any project — Claude will pick up the skill automatically when relevant.

### Option B — Claude.ai (uploaded skill)

Package the directory into a `.skill` file and upload via the skills UI:

```bash
# inside this repo
zip -r nestia.skill SKILL.md references/ assets/ examples/
```

Then upload `nestia.skill` in claude.ai → Settings → Skills.

### Option C — Anthropic API (skills beta)

Reference the directory directly when invoking the API; see [Anthropic's skills documentation](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) for the current request shape.

## When does Claude trigger this skill?

The `SKILL.md` description is intentionally specific so Claude reaches for it on:

- Any mention of `nestia`, `@nestia/core`, `@nestia/sdk`, `typia` (in a NestJS context), `@agentica`, `Agentica`.
- Symptom-style descriptions: "my SDK isn't regenerating", "Swagger is missing my routes", "validation is too slow", "I want a mockup backend for the frontend", "convert NestJS controllers to LLM function calling".
- Build errors involving `ts-patch`, `typia patch`, "transform plugin not found", NX `nestia transform`, webpack bundling.
- Architectural asks: "type-safe NestJS client SDK", "generate AI chatbot from swagger", "replace class-validator with typia".

## Verify the skill is working

Ask Claude something nestia-specific like:

> "I'm setting up nestia in an NX monorepo and `nx build` succeeds but my `@TypedBody()` decorator doesn't validate at runtime — what's wrong?"

Claude should consult `references/troubleshooting.md` and `references/setup.md` and walk through the NX-swallows-errors path plus the `tsconfig.lib.json` plugins requirement. If Claude answers from generic NestJS knowledge instead, the skill isn't loaded.

## Contributing

Pull requests welcome — particularly for:

- New failure modes encountered in the wild (add to `references/troubleshooting.md`).
- Coverage of Nestia features that get added in future releases.
- Real-world examples beyond the bbs-articles CRUD demo.

Keep `SKILL.md` under 500 lines; deeper material belongs in `references/`. See the [Anthropic skill authoring guide](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices) for conventions.

## Credits

- Nestia is authored by [Samchon (Jeongho Nam)](https://github.com/samchon) and contributors. Source: [`samchon/nestia`](https://github.com/samchon/nestia). Docs: [`nestia.io`](https://nestia.io/).
- This skill is independent of the Nestia project and is licensed separately.

## License

MIT — see [`LICENSE`](LICENSE).
