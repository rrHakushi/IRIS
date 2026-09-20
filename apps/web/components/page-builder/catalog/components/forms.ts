import type { ComponentPresetItem } from "./types"

export const formPresets: ComponentPresetItem[] = [
  {
    id: "form-input",
    name: "Text Field",
    category: "forms",
    icon: "IconForms",
    description: "Labeled text input field with placeholder",
    getNode: () => ({
      type: "Field",
      children: [
        { type: "FieldLabel", children: "Field Label" },
        { type: "Input", props: { placeholder: "Enter text..." } },
      ],
    }),
  },
  {
    id: "form-switch",
    name: "Switch Toggle",
    category: "forms",
    icon: "IconForms",
    description: "Boolean toggle switch component",
    getNode: () => ({
      type: "div",
      props: { className: "flex items-center justify-between gap-2" },
      children: [
        { type: "span", props: { className: "text-xs font-medium" }, children: "Enable Feature" },
        { type: "Switch", props: { "aria-label": "Enable Feature" } },
      ],
    }),
  },
]
