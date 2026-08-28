"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@workspace/ui/lib/utils";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  IconCheck,
  IconDeviceMobile,
  IconLayoutNavbar,
  IconLayoutBottombar,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconPlus,
} from "@tabler/icons-react";
import type {
  DockPositions,
  SidebarItem,
  SidebarPosition,
} from "@/types/sidebar-config";
import { useIrisSidebar } from "./sidebar-provider";
import { IrisBottomDock } from "./iris-bottom-dock";

export interface IrisDockSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DOCK_STORAGE_KEY = "iris-phone-dock-items-default";

export function IrisDockSettingsModal({
  open,
  onOpenChange,
}: IrisDockSettingsModalProps): React.JSX.Element {
  const t = useTranslations("navigation.dockSettings");
  const { sidebarConfig, position, setPosition } = useIrisSidebar();

  const [selectedPosition, setSelectedPosition] =
    useState<SidebarPosition>(position);
  const [focusedSlot, setFocusedSlot] = useState<string | null>("1");
  const [tempPositions, setTempPositions] = useState<DockPositions>({
    "1": null,
    "2": null,
    "3": null,
    "4": null,
  });

  // Sync position state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedPosition(position);
    }
  }, [open, position]);

  // Load existing dock shortcut slots from storage or defaults
  useEffect(() => {
    if (!open) return;

    try {
      const stored = localStorage.getItem(DOCK_STORAGE_KEY);
      if (stored) {
        setTempPositions(JSON.parse(stored));
      } else {
        const phoneSection = sidebarConfig.find(
          (s) =>
            s.section?.toLowerCase().replace(/[^a-z]/g, "") === "phone" ||
            s.dataKey?.toLowerCase() === "phone"
        );
        const defaults: DockPositions = {
          "1": null,
          "2": null,
          "3": null,
          "4": null,
        };
        if (phoneSection) {
          phoneSection.items.forEach((item) => {
            if (item.position && [1, 2, 3, 4].includes(item.position)) {
              defaults[item.position.toString()] =
                item.href || item.dataKey || item.label;
            }
          });
        }
        setTempPositions(defaults);
      }
    } catch {
      // ignore
    }
  }, [open, sidebarConfig]);

  // Lookup helper for item metadata in preview
  const findItemByKey = useCallback(
    (key: string | null | undefined): SidebarItem | undefined => {
      if (!key) return undefined;
      for (const section of sidebarConfig) {
        for (const item of section.items) {
          const itemKey = item.href || item.dataKey || item.label;
          if (itemKey === key) return item;
          if (item.children) {
            for (const child of item.children) {
              const childKey = child.href || child.dataKey || child.label;
              if (childKey === key) return child;
            }
          }
        }
      }
      return undefined;
    },
    [sidebarConfig]
  );

  // Group available items from regular sections for selection grid
  const availableItems = useMemo(() => {
    const list: SidebarItem[] = [];
    sidebarConfig.forEach((sec) => {
      const secName = sec.section?.toLowerCase().replace(/[^a-z]/g, "") || "";
      if (secName === "phone") return;

      sec.items.forEach((item) => {
        if (item.href) {
          list.push(item);
        }
        if (item.children) {
          item.children.forEach((child) => {
            if (child.href) {
              list.push(child);
            }
          });
        }
      });
    });
    return list;
  }, [sidebarConfig]);

  const handleSelectItem = (itemKey: string) => {
    if (!focusedSlot) return;
    const newPositions = { ...tempPositions };

    // Remove item from any other slot
    Object.keys(newPositions).forEach((slot) => {
      if (newPositions[slot] === itemKey) {
        newPositions[slot] = null;
      }
    });

    // Assign to current slot
    newPositions[focusedSlot] = itemKey;
    setTempPositions(newPositions);

    // Auto-advance slot 1 -> 2 -> 3 -> 4
    const slots = ["1", "2", "3", "4"];
    const currIdx = slots.indexOf(focusedSlot);
    const nextIdx = (currIdx + 1) % slots.length;
    setFocusedSlot(slots[nextIdx] ?? "1");
  };

  const handleClearSlot = (pos: string) => {
    setTempPositions((prev) => ({ ...prev, [pos]: null }));
    setFocusedSlot(pos);
  };

  const handleSave = () => {
    setPosition(selectedPosition);
    try {
      localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(tempPositions));
      window.dispatchEvent(new Event("iris-sidebar-changed"));
    } catch {
      // ignore
    }
    onOpenChange(false);
  };

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange} className="sm:max-w-xl max-h-[90vh]">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pe-1">
        {/* Section 1: Sidebar Position Settings */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("sidebarOrientation")}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Left */}
            <button
              type="button"
              onClick={() => setSelectedPosition("left")}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all text-xs font-medium cursor-pointer",
                selectedPosition === "left"
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                  : "border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <IconLayoutSidebar className="size-5" />
              <span>{t("leftDefault")}</span>
            </button>

            {/* Right / Mirrored */}
            <button
              type="button"
              onClick={() => setSelectedPosition("right")}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all text-xs font-medium cursor-pointer",
                selectedPosition === "right"
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                  : "border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <IconLayoutSidebarRight className="size-5" />
              <span>{t("rightMirrored")}</span>
            </button>

            {/* Top (Architectural placeholder) */}
            <button
              type="button"
              disabled
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border/60 opacity-50 cursor-not-allowed text-xs font-medium"
            >
              <IconLayoutNavbar className="size-5 text-muted-foreground" />
              <span className="flex items-center gap-1">
                {t("top")}
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                  {t("soon")}
                </Badge>
              </span>
            </button>

            {/* Bottom (Architectural placeholder) */}
            <button
              type="button"
              disabled
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border/60 opacity-50 cursor-not-allowed text-xs font-medium"
            >
              <IconLayoutBottombar className="size-5 text-muted-foreground" />
              <span className="flex items-center gap-1">
                {t("bottom")}
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                  {t("soon")}
                </Badge>
              </span>
            </button>
          </div>
        </div>

        {/* Section 2: Mobile Bottom Dock Customizer */}
        <div className="space-y-4 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <IconDeviceMobile className="size-4 text-primary" />
              <span>{t("mobileBottomDock")}</span>
            </h4>
            <span className="text-[11px] text-muted-foreground">
              {t("slotSelected", { slot: focusedSlot || "—" })}
            </span>
          </div>

          {/* Interactive Dock Mockup Preview */}
          <div className="flex justify-center p-3 rounded-2xl bg-muted/40 border border-border/60">
            <IrisBottomDock
              pathname="/"
              isPreview={true}
              tempPositions={tempPositions}
              focusedSlot={focusedSlot}
              onFocusSlot={setFocusedSlot}
              onClearSlot={handleClearSlot}
              findItemByKey={findItemByKey}
              emptySlotLabel={t("empty")}
            />
          </div>

          {/* Shortcut Picker Grid */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t("clickItemToAssign", { slot: focusedSlot || "1" })}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableItems.map((item) => {
                const itemKey = item.href || item.dataKey || item.label;
                const assignedSlot = Object.keys(tempPositions).find(
                  (slot) => tempPositions[slot] === itemKey
                );

                return (
                  <button
                    key={itemKey}
                    type="button"
                    onClick={() => handleSelectItem(itemKey)}
                    className={cn(
                      "flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-start cursor-pointer",
                      assignedSlot
                        ? "border-primary/50 bg-primary/5 text-primary"
                        : "border-border/80 hover:bg-muted/50 hover:border-border"
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {assignedSlot ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-4 px-1.5 shrink-0 bg-primary text-primary-foreground font-bold"
                      >
                        {t("slotBadge", { slot: assignedSlot })}
                      </Badge>
                    ) : (
                      <IconPlus className="size-3.5 text-muted-foreground shrink-0 opacity-60" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onPress={() => onOpenChange(false)}
        >
          {t("cancel")}
        </Button>
        <Button size="sm" onPress={handleSave}>
          <IconCheck className="size-4" />
          {t("saveChanges")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
