"use client"

import { useState, type ReactNode } from "react"
import {
  IconAdjustmentsHorizontal,
  IconBulb,
  IconCamera,
  IconChevronDown,
  IconChevronUp,
  IconFlipHorizontal,
  IconPalette,
  IconPhoto,
  IconPlayerPlay,
  IconRotate,
  IconSparkles,
  IconWand,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectItem,
  SelectList,
  SelectPopover,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Slider } from "@workspace/ui/components/slider"
import { Switch } from "@workspace/ui/components/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Toggle } from "@workspace/ui/components/toggle"
import type {
  ImageFilterPreset,
  LightingMode,
  LightingOptions,
  LightTintPreset,
  ReactiveSurfaceLayout,
  ViewOptions,
} from "../../../../components/reactive-backgrounds"
import {
  ANCHOR_OPTIONS,
  DEFAULT_LIGHTING_OPTIONS,
  DEFAULT_VIEW_OPTIONS,
  LIGHT_MODE_OPTIONS,
  LIGHT_PRESETS,
  LIGHT_TINT_OPTIONS,
  VIEW_PRESETS,
  type OptionItem,
} from "./presets"
import {
  BACKGROUND_BY_ID,
  BACKGROUND_VARIANTS,
  IMAGE_FILTER_OPTIONS,
  ZODIAC_BY_ID,
  ZODIAC_VARIANTS,
  type BackgroundSelection,
  type IconSelection,
} from "./zodiacs"

const DEFAULT_PLAYBACK_RATE = 100
const DEFAULT_COLOR_CHANNEL = 50
const CUSTOM_PRESET_ID = "custom"

interface LayerSelectOption {
  id: string
  name: string
  zhName: string
}

interface LayerSelectProps<T extends string> {
  label: string
  icon: ReactNode
  value: T
  activeName: string
  options: readonly LayerSelectOption[]
  onChange: (value: T) => void
}

function LayerSelect<T extends string>({
  label,
  icon,
  value,
  activeName,
  options,
  onChange,
}: LayerSelectProps<T>) {
  return (
    <div className="space-y-1.5 text-start">
      <Label className="gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </Label>
      <Select
        aria-label={label}
        selectedKey={value}
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            onChange(key as T)
          }
        }}
        className="w-full"
      >
        <SelectTrigger size="sm" className="h-8 w-full rounded-xl text-xs">
          <SelectValue>
            {() => (
              <span className="truncate font-medium text-foreground">
                {activeName}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectPopover className="max-h-72 min-w-44 rounded-xl border border-border/80 bg-popover/95 p-1 text-popover-foreground shadow-lg">
          <SelectList className="flex flex-col gap-0.5">
            <SelectItem
              id="none"
              textValue="None"
              className="rounded-lg text-xs"
            >
              <span className="text-muted-foreground">None</span>
            </SelectItem>
            {options.map((variant) => (
              <SelectItem
                key={variant.id}
                id={variant.id}
                textValue={`${variant.name} ${variant.zhName}`}
                className="rounded-lg text-xs"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span>{variant.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {variant.zhName}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectList>
        </SelectPopover>
      </Select>
    </div>
  )
}

interface OptionSelectProps<T extends string> {
  label?: string
  ariaLabel: string
  value: T
  disabled?: boolean
  options: ReadonlyArray<OptionItem<T>>
  onChange: (value: T) => void
}

function OptionSelect<T extends string>({
  label,
  ariaLabel,
  value,
  disabled = false,
  options,
  onChange,
}: OptionSelectProps<T>) {
  const activeOption = options.find((option) => option.id === value)

  return (
    <div className="space-y-1 text-start">
      {label ? (
        <span className="block text-[11px] text-muted-foreground">{label}</span>
      ) : null}
      <Select
        aria-label={ariaLabel}
        selectedKey={value}
        isDisabled={disabled}
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            onChange(key as T)
          }
        }}
        className="w-full"
      >
        <SelectTrigger size="sm" className="h-8 w-full rounded-xl text-xs">
          <SelectValue>
            {() => (
              <span className="truncate font-medium text-foreground">
                {activeOption?.label ?? "Custom"}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectPopover className="max-h-72 min-w-44 rounded-xl border border-border/80 bg-popover/95 p-1 text-popover-foreground shadow-lg">
          <SelectList className="flex flex-col gap-0.5">
            {options.map((option) => (
              <SelectItem
                key={option.id}
                id={option.id}
                textValue={option.label}
                className="rounded-lg text-xs"
              >
                <span>{option.label}</span>
              </SelectItem>
            ))}
          </SelectList>
        </SelectPopover>
      </Select>
    </div>
  )
}

interface ControlSliderProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
  onChange: (value: number) => void
}

function ControlSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  suffix = "",
  disabled = false,
  onChange,
}: ControlSliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] text-foreground tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        aria-label={label}
        minValue={min}
        maxValue={max}
        step={step}
        value={value}
        isDisabled={disabled}
        onChange={(next) => {
          const resolved = Array.isArray(next) ? next[0] : next
          if (typeof resolved === "number") onChange(resolved)
        }}
      />
    </div>
  )
}

/** Interactive Runa zodiac showcase with independent layer, view/rotation, part-lighting, animation, color, and filter controls. */
export function RunaStudio() {
  const [panelOpen, setPanelOpen] = useState(true)

  const [backgroundId, setBackgroundId] =
    useState<BackgroundSelection>("cancer-full")
  const [iconId, setIconId] = useState<IconSelection>("cancer")

  const [viewPresetId, setViewPresetId] = useState<string>("default")
  const [viewOptions, setViewOptions] =
    useState<Required<ViewOptions>>(DEFAULT_VIEW_OPTIONS)

  const [lightPresetId, setLightPresetId] = useState<string>("default")
  const [lightingOptions, setLightingOptions] = useState<
    Required<LightingOptions>
  >(DEFAULT_LIGHTING_OPTIONS)

  const [animated, setAnimated] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_PLAYBACK_RATE)

  const [colorEnabled, setColorEnabled] = useState(true)
  const [brightness, setBrightness] = useState(DEFAULT_COLOR_CHANNEL)
  const [contrast, setContrast] = useState(DEFAULT_COLOR_CHANNEL)
  const [saturation, setSaturation] = useState(DEFAULT_COLOR_CHANNEL)
  const [hueShift, setHueShift] = useState(DEFAULT_COLOR_CHANNEL)

  const [imageFilterEnabled, setImageFilterEnabled] = useState(true)
  const [imageFilter, setImageFilter] = useState<ImageFilterPreset>("none")

  const BackgroundVariant =
    backgroundId === "none" ? null : BACKGROUND_BY_ID[backgroundId].Background
  const IconVariant = iconId === "none" ? null : ZODIAC_BY_ID[iconId].Icon
  const activeBackgroundName =
    backgroundId === "none" ? "None" : BACKGROUND_BY_ID[backgroundId].name
  const activeIconName = iconId === "none" ? "None" : ZODIAC_BY_ID[iconId].name

  const colorOptions = {
    enabled: colorEnabled,
    brightness,
    contrast,
    saturation,
    hueShift,
  }

  const updateViewField = <K extends keyof Required<ViewOptions>>(
    key: K,
    value: Required<ViewOptions>[K]
  ) => {
    setViewOptions((prev) => ({ ...prev, [key]: value }))
    if (key !== "enabled") {
      setViewPresetId(CUSTOM_PRESET_ID)
    }
  }

  const applyViewPreset = (presetId: string) => {
    const preset = VIEW_PRESETS.find((item) => item.id === presetId)
    if (!preset) return
    setViewPresetId(preset.id)
    setViewOptions({ enabled: true, ...preset.options })
  }

  const updateLightField = <K extends keyof Required<LightingOptions>>(
    key: K,
    value: Required<LightingOptions>[K]
  ) => {
    setLightingOptions((prev) => ({ ...prev, [key]: value }))
    if (key !== "enabled") {
      setLightPresetId(CUSTOM_PRESET_ID)
    }
  }

  const applyLightPreset = (presetId: string) => {
    const preset = LIGHT_PRESETS.find((item) => item.id === presetId)
    if (!preset) return
    setLightPresetId(preset.id)
    setLightingOptions({ enabled: true, ...preset.options })
  }

  const resetAdjustments = () => {
    setViewPresetId("default")
    setViewOptions(DEFAULT_VIEW_OPTIONS)
    setLightPresetId("default")
    setLightingOptions(DEFAULT_LIGHTING_OPTIONS)
    setAnimated(true)
    setPlaybackRate(DEFAULT_PLAYBACK_RATE)
    setColorEnabled(true)
    setBrightness(DEFAULT_COLOR_CHANNEL)
    setContrast(DEFAULT_COLOR_CHANNEL)
    setSaturation(DEFAULT_COLOR_CHANNEL)
    setHueShift(DEFAULT_COLOR_CHANNEL)
    setImageFilterEnabled(true)
    setImageFilter("none")
  }

  const sharedSceneProps = {
    animated,
    playbackRate,
    colorOptions,
    imageFilter,
    imageFilterEnabled,
  }

  const viewPresetOptions: ReadonlyArray<OptionItem<string>> = [
    ...VIEW_PRESETS.map((item) => ({ id: item.id, label: item.label })),
    ...(viewPresetId === CUSTOM_PRESET_ID
      ? [{ id: CUSTOM_PRESET_ID, label: "Custom" }]
      : []),
  ]

  const lightPresetOptions: ReadonlyArray<OptionItem<string>> = [
    ...LIGHT_PRESETS.map((item) => ({ id: item.id, label: item.label })),
    ...(lightPresetId === CUSTOM_PRESET_ID
      ? [{ id: CUSTOM_PRESET_ID, label: "Custom" }]
      : []),
  ]

  return (
    <main className="relative h-svh w-full overflow-hidden bg-black">
      {BackgroundVariant ? (
        <BackgroundVariant
          key={`bg-${backgroundId}`}
          className="absolute inset-0 h-full w-full"
          viewOptions={viewOptions}
          lightingOptions={lightingOptions}
          {...sharedSceneProps}
        />
      ) : null}

      {IconVariant ? (
        <div className="pointer-events-none absolute start-4 top-4 z-10 h-44 w-44 sm:start-8 sm:top-6 sm:h-68 sm:w-68 lg:h-84 lg:w-84">
          <IconVariant key={`icon-${iconId}`} {...sharedSceneProps} />
        </div>
      ) : null}

      <div className="fixed end-4 top-4 z-20 w-[calc(100vw-2rem)] sm:end-6 sm:top-6 sm:w-88">
        {!panelOpen ? (
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              className="border border-border/70 bg-card/85 text-card-foreground shadow-lg backdrop-blur-xl"
              onPress={() => setPanelOpen(true)}
            >
              <IconAdjustmentsHorizontal
                data-icon="inline-start"
                className="size-4"
              />
              <span>Scene Controls</span>
              <IconChevronDown data-icon="inline-end" className="size-3.5" />
            </Button>
          </div>
        ) : (
          <Card
            size="sm"
            className="max-h-[calc(100svh-2rem)] gap-3 border border-border/70 bg-card/85 shadow-xl backdrop-blur-xl sm:max-h-[calc(100svh-3rem)]"
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0">
              <div className="flex items-center gap-2">
                <IconAdjustmentsHorizontal className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">
                  Scene Controls
                </CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label="Reset display settings"
                  onPress={resetAdjustments}
                >
                  <IconRotate data-icon="inline-start" className="size-3.5" />
                  <span>Reset</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Collapse controls"
                  onPress={() => setPanelOpen(false)}
                >
                  <IconChevronUp className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 overflow-y-auto pt-1 pb-2">
              <div className="grid grid-cols-2 gap-2.5">
                <LayerSelect
                  label="Background"
                  icon={<IconPhoto className="size-3.5" />}
                  value={backgroundId}
                  activeName={activeBackgroundName}
                  options={BACKGROUND_VARIANTS}
                  onChange={setBackgroundId}
                />
                <LayerSelect
                  label="Icon"
                  icon={<IconSparkles className="size-3.5" />}
                  value={iconId}
                  activeName={activeIconName}
                  options={ZODIAC_VARIANTS}
                  onChange={setIconId}
                />
              </div>

              <Separator />

              <Tabs defaultSelectedKey="view" className="gap-3">
                <TabsList className="grid w-full grid-cols-3 rounded-xl">
                  <TabsTrigger id="view" className="rounded-lg text-xs">
                    <IconCamera className="size-3.5" />
                    <span>View</span>
                  </TabsTrigger>
                  <TabsTrigger id="light" className="rounded-lg text-xs">
                    <IconBulb className="size-3.5" />
                    <span>Light</span>
                  </TabsTrigger>
                  <TabsTrigger id="look" className="rounded-lg text-xs">
                    <IconPalette className="size-3.5" />
                    <span>Look</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent id="view" className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="gap-1.5 text-xs font-medium text-foreground">
                      <IconCamera className="size-3.5 text-muted-foreground" />
                      <span>Position & Framing</span>
                    </Label>
                    <Switch
                      aria-label="Toggle custom position and view"
                      size="sm"
                      isSelected={viewOptions.enabled}
                      onChange={(val) => updateViewField("enabled", val)}
                    />
                  </div>

                  <OptionSelect
                    label="View Preset"
                    ariaLabel="View preset"
                    value={viewPresetId}
                    disabled={!viewOptions.enabled}
                    options={viewPresetOptions}
                    onChange={applyViewPreset}
                  />

                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <OptionSelect
                        label="Anchor"
                        ariaLabel="Viewport anchor"
                        value={viewOptions.anchor}
                        disabled={!viewOptions.enabled}
                        options={ANCHOR_OPTIONS}
                        onChange={(val) =>
                          updateViewField(
                            "anchor",
                            val as ReactiveSurfaceLayout
                          )
                        }
                      />
                    </div>
                    <Toggle
                      variant="outline"
                      size="sm"
                      aria-label="Flip horizontally"
                      isDisabled={!viewOptions.enabled}
                      isSelected={viewOptions.flipX}
                      onChange={(val) => updateViewField("flipX", val)}
                      className="h-8 rounded-xl px-2.5 text-xs"
                    >
                      <IconFlipHorizontal
                        data-icon="inline-start"
                        className="size-3.5"
                      />
                      <span>Flip X</span>
                    </Toggle>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <ControlSlider
                      label="Zoom"
                      value={viewOptions.zoom}
                      min={40}
                      max={300}
                      step={5}
                      suffix="%"
                      disabled={!viewOptions.enabled}
                      onChange={(val) => updateViewField("zoom", val)}
                    />
                    <ControlSlider
                      label="Rotation"
                      value={viewOptions.rotation}
                      min={-180}
                      max={180}
                      step={1}
                      suffix="°"
                      disabled={!viewOptions.enabled}
                      onChange={(val) => updateViewField("rotation", val)}
                    />
                    <ControlSlider
                      label="Offset X"
                      value={viewOptions.panX}
                      min={-100}
                      max={100}
                      step={1}
                      disabled={!viewOptions.enabled}
                      onChange={(val) => updateViewField("panX", val)}
                    />
                    <ControlSlider
                      label="Offset Y"
                      value={viewOptions.panY}
                      min={-100}
                      max={100}
                      step={1}
                      disabled={!viewOptions.enabled}
                      onChange={(val) => updateViewField("panY", val)}
                    />
                    <ControlSlider
                      label="3D Tilt X"
                      value={viewOptions.tiltX}
                      min={-45}
                      max={45}
                      step={1}
                      suffix="°"
                      disabled={!viewOptions.enabled}
                      onChange={(val) => updateViewField("tiltX", val)}
                    />
                    <ControlSlider
                      label="3D Tilt Y"
                      value={viewOptions.tiltY}
                      min={-45}
                      max={45}
                      step={1}
                      suffix="°"
                      disabled={!viewOptions.enabled}
                      onChange={(val) => updateViewField("tiltY", val)}
                    />
                  </div>
                </TabsContent>

                <TabsContent id="light" className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="gap-1.5 text-xs font-medium text-foreground">
                      <IconBulb className="size-3.5 text-muted-foreground" />
                      <span>Part Lighting & Spotlight</span>
                    </Label>
                    <Switch
                      aria-label="Toggle part lighting"
                      size="sm"
                      isSelected={lightingOptions.enabled}
                      onChange={(val) => updateLightField("enabled", val)}
                    />
                  </div>

                  <OptionSelect
                    label="Lighting Preset"
                    ariaLabel="Lighting preset"
                    value={lightPresetId}
                    disabled={!lightingOptions.enabled}
                    options={lightPresetOptions}
                    onChange={applyLightPreset}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <OptionSelect
                      label="Mode"
                      ariaLabel="Lighting mode"
                      value={lightingOptions.mode}
                      disabled={!lightingOptions.enabled}
                      options={LIGHT_MODE_OPTIONS}
                      onChange={(val) =>
                        updateLightField("mode", val as LightingMode)
                      }
                    />
                    <OptionSelect
                      label="Tint"
                      ariaLabel="Light color tint"
                      value={lightingOptions.tint}
                      disabled={!lightingOptions.enabled}
                      options={LIGHT_TINT_OPTIONS}
                      onChange={(val) =>
                        updateLightField("tint", val as LightTintPreset)
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <ControlSlider
                      label="Ambient Base"
                      value={lightingOptions.ambient}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      disabled={!lightingOptions.enabled}
                      onChange={(val) => updateLightField("ambient", val)}
                    />
                    <ControlSlider
                      label="Spot Boost"
                      value={lightingOptions.intensity}
                      min={0}
                      max={250}
                      step={5}
                      suffix="%"
                      disabled={!lightingOptions.enabled}
                      onChange={(val) => updateLightField("intensity", val)}
                    />
                    <ControlSlider
                      label="Beam Size"
                      value={lightingOptions.radius}
                      min={10}
                      max={120}
                      step={2}
                      suffix="%"
                      disabled={!lightingOptions.enabled}
                      onChange={(val) => updateLightField("radius", val)}
                    />
                    <ControlSlider
                      label="Softness"
                      value={lightingOptions.softness}
                      min={10}
                      max={100}
                      step={2}
                      suffix="%"
                      disabled={!lightingOptions.enabled}
                      onChange={(val) => updateLightField("softness", val)}
                    />
                    <ControlSlider
                      label="Focus X"
                      value={lightingOptions.focusX}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      disabled={!lightingOptions.enabled}
                      onChange={(val) => updateLightField("focusX", val)}
                    />
                    <ControlSlider
                      label="Focus Y"
                      value={lightingOptions.focusY}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      disabled={!lightingOptions.enabled}
                      onChange={(val) => updateLightField("focusY", val)}
                    />
                  </div>
                </TabsContent>

                <TabsContent id="look" className="space-y-3">
                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="gap-1.5 text-xs font-medium text-foreground">
                        <IconPlayerPlay className="size-3.5 text-muted-foreground" />
                        <span>Animation</span>
                      </Label>
                      <Switch
                        aria-label="Toggle animation"
                        size="sm"
                        isSelected={animated}
                        onChange={setAnimated}
                      />
                    </div>
                    <ControlSlider
                      label="Playback Rate"
                      value={playbackRate}
                      min={0}
                      max={250}
                      step={5}
                      suffix="%"
                      disabled={!animated}
                      onChange={setPlaybackRate}
                    />
                  </section>

                  <Separator />

                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="gap-1.5 text-xs font-medium text-foreground">
                        <IconPalette className="size-3.5 text-muted-foreground" />
                        <span>Color Options</span>
                      </Label>
                      <Switch
                        aria-label="Toggle color options"
                        size="sm"
                        isSelected={colorEnabled}
                        onChange={setColorEnabled}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      <ControlSlider
                        label="Brightness"
                        value={brightness}
                        disabled={!colorEnabled}
                        onChange={setBrightness}
                      />
                      <ControlSlider
                        label="Contrast"
                        value={contrast}
                        disabled={!colorEnabled}
                        onChange={setContrast}
                      />
                      <ControlSlider
                        label="Saturation"
                        value={saturation}
                        disabled={!colorEnabled}
                        onChange={setSaturation}
                      />
                      <ControlSlider
                        label="Hue Shift"
                        value={hueShift}
                        disabled={!colorEnabled}
                        onChange={setHueShift}
                      />
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="gap-1.5 text-xs font-medium text-foreground">
                        <IconWand className="size-3.5 text-muted-foreground" />
                        <span>Image Filter</span>
                      </Label>
                      <Switch
                        aria-label="Toggle image filter"
                        size="sm"
                        isSelected={imageFilterEnabled}
                        onChange={setImageFilterEnabled}
                      />
                    </div>
                    <OptionSelect
                      ariaLabel="Image filter preset"
                      value={imageFilter}
                      disabled={!imageFilterEnabled}
                      options={IMAGE_FILTER_OPTIONS}
                      onChange={(val) =>
                        setImageFilter(val as ImageFilterPreset)
                      }
                    />
                  </section>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
