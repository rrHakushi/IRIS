import { setupTypebox } from 'elysia'
import * as type from 'typebox/type'
import * as system from 'typebox/system'
import * as value from 'typebox/value'
import * as compile from 'typebox/compile'
import * as schema from 'typebox/schema'

// Statically wire TypeBox so that standalone compiled binaries (bun build --compile)
// do not attempt dynamic filesystem require calls at runtime.
setupTypebox({
  typebox: {
    type,
    system,
    value,
    schema,
    compile: compile as any,
  },
})
