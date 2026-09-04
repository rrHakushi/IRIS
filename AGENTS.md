<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design System & UI Specification

When building, styling, or modifying UI components and pages in `apps/web`:
- **Strictly adhere to the design guidelines in [design.md](file:///c:/Users/yki/Documents/GitHub/IRIS/design.md)**.
- Use shadcn/ui components (`aria-rhea` style) with Mauve neutral base and Rose theme accent.
- Use `@tabler/icons-react` icons exclusively.
- Use logical CSS properties (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`, `text-end`) for RTL/LTR support.
- Maintain a clean, minimalist aesthetic with zero unnecessary visual bloat.
