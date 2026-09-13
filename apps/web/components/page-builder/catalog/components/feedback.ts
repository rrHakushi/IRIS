import type { ComponentPresetItem } from "./types"

export const feedbackPresets: ComponentPresetItem[] = [
  {
    id: "feedback-alert",
    name: "Alert Notice",
    category: "feedback",
    icon: "IconMessageCircle",
    description: "Callout alert box for notices and warnings",
    getNode: () => ({
      type: "Alert",
      props: { variant: "default" },
      children: [
        { type: "AlertTitle", children: "Notification" },
        { type: "AlertDescription", children: "This is an important update or status note." },
      ],
    }),
  },
  {
    id: "feedback-avatar",
    name: "User Avatar",
    category: "feedback",
    icon: "IconUser",
    description: "Rounded avatar with fallback initials",
    getNode: () => ({
      type: "Avatar",
      props: { size: "default" },
      children: [{ type: "AvatarFallback", children: "IU" }],
    }),
  },
]
