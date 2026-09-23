"use client"

import React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconLink,
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandSteam,
  IconWorld,
  IconCheck,
  IconExternalLink,
} from "@tabler/icons-react"
import { UserProfileComments } from "../user-profile-comments"
import { ProviderIcon } from "../../navigation/settings-tabs/account/connections/icons"

export interface ConnectionsTabProps {
  username: string
  connections: any[]
  isOwner: boolean
}

export function ConnectionsTab({
  username,
  connections = [],
  isOwner,
}: ConnectionsTabProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
      {/* Left Column: Connected Integrations */}
      <div className="space-y-6 xl:col-span-6">
        <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <IconLink className="size-4 text-primary" />
              Connected Third-Party Services
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              External platforms and accounts linked to @{username}&apos;s profile.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {connections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                No public integrations connected to this profile.
              </div>
            ) : (
              <div className="space-y-2.5">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl border border-border/50 bg-card p-1.5 shadow-2xs">
                        <ProviderIcon provider={conn.provider} iconUrl={conn.iconUrl} className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground capitalize">
                            {conn.provider.toLowerCase()}
                          </span>
                          <Badge className="h-4 border-emerald-500/30 bg-emerald-500/10 px-1 text-[8px] font-bold text-emerald-400">
                            Connected
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {conn.displayName || "Linked account"}
                        </span>
                      </div>
                    </div>

                    {conn.profileUrl && (
                      <a
                        href={conn.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex size-7 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      >
                        <IconExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Profile Guestbook & Comments */}
      <div className="xl:col-span-6">
        <UserProfileComments username={username} isOwner={isOwner} />
      </div>
    </div>
  )
}
