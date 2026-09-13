import type { ComponentPresetItem } from "./types"

export const actionPresets: ComponentPresetItem[] = [
  {
    id: "action-button",
    name: "Button",
    category: "actions",
    icon: "IconHandClick",
    description: "Interactive button with press handler and variant styles",
    getNode: () => ({
      type: "Button",
      props: { variant: "default", onPress: "toast.success('Action clicked!')" },
      children: "Click Me",
    }),
  },
  {
    id: "action-icon-button",
    name: "Icon Button",
    category: "actions",
    icon: "IconSparkles",
    description: "Button containing a Tabler icon and label",
    getNode: () => ({
      type: "Button",
      props: { variant: "outline", className: "gap-2" },
      children: [
        { type: "Icon", props: { name: "IconSparkles", className: "size-4 text-primary" } },
        "Action with Icon",
      ],
    }),
  },
]
