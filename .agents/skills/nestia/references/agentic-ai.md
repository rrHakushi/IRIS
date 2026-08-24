# Agentic AI — `@agentica` integration

`@agentica` is a separate package family (formerly `@nestia/agent`, now its own ecosystem under `wrtnlabs/agentica`) that turns a Swagger document and/or TypeScript class types into an LLM function-calling agent. The path is: nestia generates the swagger → agentica turns each operation into a function-calling schema → an LLM picks which function to call from a user message → agentica executes it against the real backend → typia validates the LLM's argument composition and feeds errors back if it got the shape wrong.

## The pitch

Building "an AI chatbot for my API" used to mean writing function-calling glue per endpoint, hand-curating prompts, fighting with arg validation, and praying the LLM didn't hallucinate field names. With `@agentica`:

- One swagger document → all endpoints exposed as functions automatically.
- typia validates every LLM-composed argument against the original TypeScript type.
- On validation failure, the validator's structured error feeds back to the LLM as a retry hint. With `gpt-4o-mini`, this typically takes first-attempt success from ~50% to ~99% on the second attempt; failures past two retries are rare.
- Selector / caller / describer agent split keeps the planning, execution, and explanation stages separate, which keeps the prompts smaller and the latency lower.

## Packages

- **`@agentica/core`** — the agent framework.
- **`@agentica/rpc`** — WebSocket RPC integration via `tgrid`. Used to wire an agent to a NestJS WebSocket controller so a chat UI can connect.
- **`@samchon/openapi`** — OpenAPI document normalizer (downgrades 3.0/2.0 to an emended 3.1, then to a vendor-neutral migration schema, then to vendor-specific function-calling schemas like ChatGPT's, Claude's, Gemini's).
- **`tgrid`** — WebSocket RPC library. Already used by `@WebSocketRoute` decorators.

```bash
npm install @agentica/core @agentica/rpc @samchon/openapi tgrid
```

## Minimal agent

```ts
import { Agentica } from "@agentica/core";
import { OpenApi, HttpLlm } from "@samchon/openapi";
import OpenAI from "openai";

const agent = new Agentica({
  model: "chatgpt",
  vendor: {
    api: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    model: "gpt-4o-mini",
  },
  controllers: [
    {
      protocol: "http",
      name: "shopping",
      application: HttpLlm.application({
        model: "chatgpt",
        document: OpenApi.convert(
          await fetch("https://shopping-be.wrtn.ai/editor/swagger.json").then(r => r.json()),
        ),
      }),
      connection: {
        host: "https://shopping-be.wrtn.ai",
        headers: { Authorization: `Bearer ${process.env.SHOPPING_TOKEN}` },
      },
    },
  ],
});

await agent.conversate("I'd like to buy a MacBook Pro under $2000.");
```

`OpenApi.convert(swaggerJson)` does the version-normalize step. `HttpLlm.application({ document, model })` produces the function-calling schema array specific to the chosen model (`"chatgpt"`, `"claude"`, `"gemini"`, `"deepseek"`, `"3.0"` for generic 3.0 OpenAPI consumers, `"3.1"` for generic 3.1).

## Mixing HTTP controllers with TypeScript class controllers

A controller can also be a plain TypeScript class — useful for in-memory agents like a "policy advisor" or a RAG handler that doesn't have an HTTP endpoint:

```ts
class ShoppingCounselor {
  /** Recommend a category based on the customer's stated budget and use case. */
  async recommend(input: { budget: number; useCase: string }): Promise<{ category: string; reasoning: string }> {
    // domain logic
    return { category: "laptops", reasoning: "..." };
  }
}

const agent = new Agentica({
  model: "chatgpt",
  vendor: { api: new OpenAI({ apiKey: "..." }), model: "gpt-4o-mini" },
  controllers: [
    {
      protocol: "class",
      name: "counselor",
      application: typia.llm.application<ShoppingCounselor, "chatgpt">(),
      execute: new ShoppingCounselor(),
    },
    // ...mix with http controllers as needed
  ],
});
```

`typia.llm.application<Class, "chatgpt">()` is the build-time analog of `HttpLlm.application` for plain classes — it walks the class's methods, parameter types, and JSDoc to build the function-calling schemas.

This is why JSDoc on DTOs and parameters matters so much: it's how the LLM learns what each field means, which dramatically lowers hallucination rates. For an agentic deployment, treat JSDoc as a first-class part of the API surface, not just developer documentation.

## Wiring an agent to a NestJS WebSocket route

The recommended chatbot deployment uses `@WebSocketRoute` plus `@agentica/rpc`. The controller pattern:

```ts
import { AgenticaRpcService, IAgenticaRpcListener } from "@agentica/rpc";
import { WebSocketRoute } from "@nestia/core";
import { Agentica } from "@agentica/core";
import { Controller } from "@nestjs/common";
import { WebSocketAcceptor } from "tgrid";

@Controller("chat")
export class ChatController {
  @WebSocketRoute()
  async start(
    @WebSocketRoute.Acceptor()
    acceptor: WebSocketAcceptor<null, AgenticaRpcService, IAgenticaRpcListener>,
  ): Promise<void> {
    const agent = new Agentica({
      // ...config from earlier
    });
    await acceptor.accept(
      new AgenticaRpcService({
        agent,
        listener: acceptor.getDriver(),
      }),
    );
  }
}
```

And in the bootstrap:

```ts
import { NestFactory } from "@nestjs/core";
import { WebSocketAdaptor } from "@nestia/core";
import { AppModule } from "./AppModule";

const app = await NestFactory.create(AppModule);
await WebSocketAdaptor.upgrade(app);
await app.listen(3001);
```

`WebSocketAdaptor.upgrade(app)` is essential — without it, the WebSocket route never accepts connections.

Once running, a client connects to `ws://localhost:3001/chat`, calls `service.conversate("...")`, and receives streamed events (function calls, function results, assistant text) via the `IAgenticaRpcListener` driver. The SDK generated by `npx nestia sdk` handles the WebSocket plumbing on the client side.

## How the agent decides what to call

The internal flow:

1. **Selector agent** — receives the user message, decides which (if any) of the available functions could plausibly answer it. If none fit and there's no in-flight candidate, the conversation continues like a vanilla ChatGPT call.
2. **Caller agent** — for each selected function, tries to compose its arguments from the user's message and the conversation history. If the args are complete and pass typia validation, the function is actually called. If they're incomplete, the agent asks the user follow-up questions.
3. **Describer agent** — once functions return, summarizes the results in natural language to the user.

The split keeps each prompt small and focused. Selector prompts list function names + summaries; caller prompts include the full schema only for the selected function; describer prompts only see the function's output, not its schema.

## Validation feedback — why it's the secret sauce

The retry-with-validation-errors pattern is what turns LLM function calling from "useful but flaky" to "reliable in production":

```ts
import { ILlmFunction, IValidation } from "typia";

export const correctFunctionCall = (p: {
  call: { name: string; arguments: unknown };
  functions: Array<ILlmFunction<"chatgpt">>;
  retry: (reason: string, errors?: IValidation.IError[]) => Promise<unknown>;
}): Promise<unknown> => {
  const func = p.functions.find(f => f.name === p.call.name);
  if (!func) return p.retry("Unable to find the matched function name. Try it again.");

  const result: IValidation<unknown> = func.validate(p.call.arguments);
  if (!result.success) {
    return p.retry(
      "Type errors are detected. Correct it through validation errors.",
      result.errors, // structured: { path, expected, value } per error
    );
  }
  return result.data;
};
```

`func.validate` is `typia.validate<T>` under the hood — same compile-time-generated validator used by `@TypedBody`. The error array it produces is precise enough that the LLM, upon receiving it, almost always corrects the offending field in the next attempt.

This is also why typia (and not zod / class-validator / yup) is the right validator for agentic deployments: only typia generates errors with structured paths and expected types, derived from the original TypeScript source, with no schema duplication.

## Playground & shopping-mall demo

Hosted playground for trying agents on any swagger document: `https://nestia.io/chat/playground/`. Drop a `swagger.json` in, set OpenAI key, start chatting.

Shopping mall demo (a fully realized e-commerce backend with an agentic chatbot front-end):
- Demo: `https://nestia.io/chat/shopping/`
- Backend: `https://github.com/samchon/shopping-backend`
- Swagger editor link: `https://nestia.io/editor/?simulate=true&e2e=true&url=https%3A%2F%2Fraw.githubusercontent.com%2Fsamchon%2Fshopping-backend%2Frefs%2Fheads%2Fmaster%2Fpackages%2Fapi%2Fswagger.json`

## When to recommend `@agentica`

- The user wants an "AI assistant" / "chatbot" / "natural language interface" on top of an existing NestJS API.
- The user is building an MCP-like internal tool layer where LLMs need to invoke real backend functions.
- The user has a typia / nestia codebase and asks about LLM function calling — the integration is essentially free.

Don't recommend `@agentica` for:

- Pure RAG / retrieval scenarios where the LLM doesn't need to call backend functions.
- Strict deterministic flows where natural-language input would be a regression in UX.
- Cases without a server to call — `@agentica/core` is for connecting agents to backends; if there's no backend, a simpler agent framework is a better fit.
