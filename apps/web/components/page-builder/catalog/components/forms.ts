import type { ComponentPresetItem } from "./types"

export const formPresets: ComponentPresetItem[] = [
  {
    id: "form-input",
    name: "Text Field",
    category: "forms",
    icon: "IconForms",
    description: "Labeled text input with state two-way binding",
    getNode: () => ({
      type: "Field",
      children: [
        { type: "FieldLabel", children: "Field Label" },
        { type: "Input", props: { placeholder: "Enter text...", bind: "state.textVal" } },
      ],
    }),
  },
  {
    id: "form-switch",
    name: "Switch Toggle",
    category: "forms",
    icon: "IconForms",
    description: "Boolean toggle switch with bindChecked",
    getNode: () => ({
      type: "div",
      props: { className: "flex items-center justify-between gap-2" },
      children: [
        { type: "span", props: { className: "text-xs font-medium" }, children: "Enable Feature" },
        { type: "Switch", props: { bindChecked: "state.isEnabled" } },
      ],
    }),
  },
]
