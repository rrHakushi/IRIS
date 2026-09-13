import type { ActionCatalogItem } from "./types"

export * from "./types"
export { setStateAction } from "./set-state"
export { toggleStateAction } from "./toggle-state"
export { pushArrayAction } from "./push-array"
export { removeArrayAction } from "./remove-array"
export { toastSuccessAction } from "./toast-success"
export { toastErrorAction } from "./toast-error"
export { toastInfoAction } from "./toast-info"
export { toastWarningAction } from "./toast-warning"
export { elysiaGetAction } from "./elysia-get"
export { elysiaPostAction } from "./elysia-post"
export { themeToggleAction } from "./theme-toggle"
export { themeSetAction } from "./theme-set"
export { sidebarToggleAction } from "./sidebar-toggle"
export { hostEmitAction } from "./host-emit"
export { helperDateAction } from "./helper-date"
export { helperNumberAction } from "./helper-number"

import { setStateAction } from "./set-state"
import { toggleStateAction } from "./toggle-state"
import { pushArrayAction } from "./push-array"
import { removeArrayAction } from "./remove-array"
import { toastSuccessAction } from "./toast-success"
import { toastErrorAction } from "./toast-error"
import { toastInfoAction } from "./toast-info"
import { toastWarningAction } from "./toast-warning"
import { elysiaGetAction } from "./elysia-get"
import { elysiaPostAction } from "./elysia-post"
import { themeToggleAction } from "./theme-toggle"
import { themeSetAction } from "./theme-set"
import { sidebarToggleAction } from "./sidebar-toggle"
import { hostEmitAction } from "./host-emit"
import { helperDateAction } from "./helper-date"
import { helperNumberAction } from "./helper-number"

/**
 * Complete catalog of all available actions in the IrisPage SDUI sandbox.
 * To add, remove, or edit an action, simply create or modify its file in this directory.
 */
export const ACTION_CATALOG: ActionCatalogItem[] = [
  setStateAction,
  toggleStateAction,
  pushArrayAction,
  removeArrayAction,
  toastSuccessAction,
  toastErrorAction,
  toastInfoAction,
  toastWarningAction,
  elysiaGetAction,
  elysiaPostAction,
  themeToggleAction,
  themeSetAction,
  sidebarToggleAction,
  hostEmitAction,
  helperDateAction,
  helperNumberAction,
]
