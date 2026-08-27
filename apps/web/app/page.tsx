"use client";

import React, { useState } from "react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar";
import {
  IrisSidebarProvider,
  IrisSidebar,
  IrisDockSettingsModal,
  getDefaultSidebarConfig,
  useIrisSidebar,
} from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Separator } from "@workspace/ui/components/separator";
import {
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconSettings,
  IconSparkles,
  IconDeviceMobile,
  IconShieldLock,
  IconCheck,
  IconChartBar,
  IconActivity,
  IconUsers,
} from "@tabler/icons-react";

function DashboardContent({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const { position, setPosition, sidebarConfig } = useIrisSidebar();
  const isRight = position === "right";

  return (
    <div className="flex flex-col flex-1 min-h-full bg-background text-foreground rounded-[inherit] overflow-hidden">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 backdrop-blur-md px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">IRIS Dashboard</span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0 h-4">
              v2.0
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <IconSparkles className="size-3.5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  IRIS Dynamic Navigation System
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Config-driven navigation with RBAC permission integration, responsive mobile bottom dock, and real-time Left / Right mirrored orientation switching.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1 text-xs gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active: {position.toUpperCase()}</span>
              </Badge>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <IconLayoutSidebarRight className="size-4 text-primary" />
                Orientation & Mirroring
              </CardTitle>
              <CardDescription className="text-xs">
                Toggle between Left and Right / Mirrored sidebar layout with persistent local state.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={!isRight ? "default" : "outline"}
                  className="flex-1 text-xs"
                  onPress={() => setPosition("left")}
                >
                  Left Side
                </Button>
                <Button
                  size="sm"
                  variant={isRight ? "default" : "outline"}
                  className="flex-1 text-xs"
                  onPress={() => setPosition("right")}
                >
                  Right Side
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <IconDeviceMobile className="size-4 text-primary" />
                Mobile Bottom Dock
              </CardTitle>
              <CardDescription className="text-xs">
                Floating capsule navigation dock on mobile with 4 custom quick slots and long-press submenus.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5"
                onPress={onOpenSettings}
              >
                <IconSettings className="size-3.5" />
                Configure Dock Slots
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <IconShieldLock className="size-4 text-primary" />
                RBAC Permissions
              </CardTitle>
              <CardDescription className="text-xs">
                Integrated with @IRIS/permissions engine for section and item visibility gating.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <IconCheck className="size-4 text-emerald-500" />
                <span>Admin bypass & BigInt evaluation enabled</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Sections</span>
              <IconChartBar className="size-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mt-2">{sidebarConfig.length}</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Dock Slots</span>
              <IconDeviceMobile className="size-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mt-2">4 Quick Slots</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Active Position</span>
              <IconLayoutSidebar className="size-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mt-2 capitalize">{position}</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">System Health</span>
              <IconActivity className="size-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold mt-2 text-emerald-500">100%</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const initialConfig = getDefaultSidebarConfig();

  return (
    <IrisSidebarProvider initialConfig={initialConfig}>
      <SidebarProvider defaultOpen={true}>
        <IrisSidebar
          initialConfig={initialConfig}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <SidebarInset>
          <DashboardContent onOpenSettings={() => setSettingsOpen(true)} />
        </SidebarInset>

        <IrisDockSettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      </SidebarProvider>
    </IrisSidebarProvider>
  );
}