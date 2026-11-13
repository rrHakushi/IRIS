import type { ComponentType } from "react"
import {
  AquariusBackground,
  AriesBackground,
  CancerBackground,
  CancerFullBackground,
  CapricornBackground,
  GeminiBackground,
  LeoBackground,
  LibraBackground,
  PiscesBackground,
  SagittariusBackground,
  ScorpioBackground,
  TaurusBackground,
  VirgoBackground,
  type ImageFilterPreset,
  type ReactiveBackgroundVariantProps,
} from "../../../../components/reactive-backgrounds"
import {
  AquariusIcon,
  AriesIcon,
  CancerIcon,
  CapricornIcon,
  GeminiIcon,
  LeoIcon,
  LibraIcon,
  PiscesIcon,
  SagittariusIcon,
  ScorpioIcon,
  TaurusIcon,
  VirgoIcon,
  type ReactiveIconVariantProps,
} from "../../../../components/reactive-icons"

export type ZodiacId =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces"

export type BackgroundId = ZodiacId | "cancer-full"
export type BackgroundSelection = BackgroundId | "none"
export type IconSelection = ZodiacId | "none"

export interface BackgroundEntry {
  id: BackgroundId
  name: string
  zhName: string
  Background: ComponentType<ReactiveBackgroundVariantProps>
}

export interface ZodiacEntry {
  id: ZodiacId
  name: string
  zhName: string
  Background: ComponentType<ReactiveBackgroundVariantProps>
  Icon: ComponentType<ReactiveIconVariantProps>
}

export const ZODIAC_VARIANTS: readonly ZodiacEntry[] = [
  {
    id: "aries",
    name: "Aries",
    zhName: "白羊座",
    Background: AriesBackground,
    Icon: AriesIcon,
  },
  {
    id: "taurus",
    name: "Taurus",
    zhName: "金牛座",
    Background: TaurusBackground,
    Icon: TaurusIcon,
  },
  {
    id: "gemini",
    name: "Gemini",
    zhName: "双子座",
    Background: GeminiBackground,
    Icon: GeminiIcon,
  },
  {
    id: "cancer",
    name: "Cancer",
    zhName: "巨蟹座",
    Background: CancerBackground,
    Icon: CancerIcon,
  },
  {
    id: "leo",
    name: "Leo",
    zhName: "狮子座",
    Background: LeoBackground,
    Icon: LeoIcon,
  },
  {
    id: "virgo",
    name: "Virgo",
    zhName: "处女座",
    Background: VirgoBackground,
    Icon: VirgoIcon,
  },
  {
    id: "libra",
    name: "Libra",
    zhName: "天秤座",
    Background: LibraBackground,
    Icon: LibraIcon,
  },
  {
    id: "scorpio",
    name: "Scorpio",
    zhName: "天蝎座",
    Background: ScorpioBackground,
    Icon: ScorpioIcon,
  },
  {
    id: "sagittarius",
    name: "Sagittarius",
    zhName: "射手座",
    Background: SagittariusBackground,
    Icon: SagittariusIcon,
  },
  {
    id: "capricorn",
    name: "Capricorn",
    zhName: "摩羯座",
    Background: CapricornBackground,
    Icon: CapricornIcon,
  },
  {
    id: "aquarius",
    name: "Aquarius",
    zhName: "水瓶座",
    Background: AquariusBackground,
    Icon: AquariusIcon,
  },
  {
    id: "pisces",
    name: "Pisces",
    zhName: "双鱼座",
    Background: PiscesBackground,
    Icon: PiscesIcon,
  },
] as const

export const BACKGROUND_VARIANTS: readonly BackgroundEntry[] =
  ZODIAC_VARIANTS.flatMap((entry): BackgroundEntry[] =>
    entry.id === "cancer"
      ? [
          entry,
          {
            id: "cancer-full",
            name: "Cancer Full",
            zhName: "巨蟹座 · 全身",
            Background: CancerFullBackground,
          },
        ]
      : [entry]
  )

export const ZODIAC_BY_ID: Record<ZodiacId, ZodiacEntry> = Object.fromEntries(
  ZODIAC_VARIANTS.map((entry) => [entry.id, entry])
) as Record<ZodiacId, ZodiacEntry>

export const BACKGROUND_BY_ID: Record<BackgroundId, BackgroundEntry> =
  Object.fromEntries(
    BACKGROUND_VARIANTS.map((entry) => [entry.id, entry])
  ) as Record<BackgroundId, BackgroundEntry>

export const IMAGE_FILTER_OPTIONS: ReadonlyArray<{
  id: ImageFilterPreset
  label: string
}> = [
  { id: "none", label: "None" },
  { id: "vibrant-darkness", label: "Vibrant Darkness" },
  { id: "moon-light", label: "Moon Light" },
  { id: "overcast", label: "Overcast" },
]
