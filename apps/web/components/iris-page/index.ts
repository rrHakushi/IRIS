export { IrisPage, type IrisPageProps } from "./iris-page"
export {
  COMPONENT_REGISTRY,
  resolveComponent,
  resolveTablerIcon,
  DynamicIcon,
  ALL_TABLER_ICON_NAMES,
  HTML_TAGS,
} from "./registry"
export { evaluateExpression, executeScript, getByPath, setByPath, toggleByPath, pushByPath, removeByPath } from "./sandbox"
export { resolveProps, isIrisSlot } from "./resolve-props"
export { IrisErrorBoundary } from "./error-boundary"
export type {
  IrisPageSchema,
  IrisNode,
  IrisChild,
  IrisSlot,
  IrisPropValue,
  IrisRepeatDescriptor,
  SandboxContext,
  SandboxThemeContext,
} from "./types"
