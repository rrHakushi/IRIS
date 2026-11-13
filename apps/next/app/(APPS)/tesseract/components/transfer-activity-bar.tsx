"use client"

import React from "react"
import { useTranslations } from "next-intl"
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCheck,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { cn } from "@workspace/ui/lib/utils"
import { useTesseract } from "@/context/tesseract-context"
import {
  formatBytes,
  formatEta,
  formatSpeed,
} from "@/lib/tesseract/device-info"

export function TransferActivityBar({
  embedded = false,
}: {
  embedded?: boolean
} = {}) {
  const t = useTranslations("tesseract")
  const { transfers, cancelTransfer, clearCompletedTransfers } = useTesseract()

  if (transfers.length === 0) return null

  const hasFinished = transfers.some(
    (item) => item.status !== "active" && item.status !== "pending-approval"
  )

  return (
    <section
      className={
        embedded
          ? "flex flex-col gap-2"
          : "rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs"
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("transfers.title")}
          </h2>
          <Badge variant="secondary" className="text-xs">
            {transfers.length}
          </Badge>
        </div>

        {hasFinished && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={clearCompletedTransfers}
            className="text-muted-foreground"
          >
            <IconTrash data-icon="inline-start" className="size-3.5" />
            <span>{t("transfers.clearHistory")}</span>
          </Button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {transfers.map((task) => {
          const pct =
            task.totalBytes > 0
              ? Math.min(
                  100,
                  Math.round((task.transferredBytes / task.totalBytes) * 100)
                )
              : task.status === "completed"
                ? 100
                : 0
          const isRunning =
            task.status === "active" || task.status === "pending-approval"

          return (
            <li
              key={task.id}
              className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/70 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg",
                      task.direction === "send"
                        ? "bg-lime-500/15 text-lime-500"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {task.direction === "send" ? (
                      <IconArrowUpRight className="size-4" />
                    ) : (
                      <IconArrowDownLeft className="size-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-foreground">
                        {task.itemsSummary}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {task.mode === "direct"
                          ? t("transfers.modeDirect")
                          : t("transfers.modePull")}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {task.direction === "send"
                        ? t("transfers.sendingTo", { peer: task.peerAlias })
                        : t("transfers.receivingFrom", {
                            peer: task.peerAlias,
                          })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {task.status === "active" && (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {formatBytes(task.transferredBytes)} /{" "}
                      {formatBytes(task.totalBytes)} ·{" "}
                      {formatSpeed(task.speedBytesPerSec)} ·{" "}
                      {formatEta(task.etaSeconds)}
                    </span>
                  )}

                  {task.status === "pending-approval" && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-600 dark:text-amber-400"
                    >
                      {t("transfers.awaitingApproval")}
                    </Badge>
                  )}

                  {task.status === "completed" && (
                    <Badge className="gap-1 bg-lime-500/15 text-[11px] text-lime-600 dark:text-lime-400">
                      <IconCheck className="size-3" />
                      <span>{t("transfers.completed")}</span>
                    </Badge>
                  )}

                  {(task.status === "failed" ||
                    task.status === "declined" ||
                    task.status === "cancelled") && (
                    <Badge variant="destructive" className="text-[11px]">
                      {task.error ||
                        (task.status === "declined"
                          ? t("transfers.declined")
                          : task.status === "cancelled"
                            ? t("transfers.cancelled")
                            : t("transfers.failed"))}
                    </Badge>
                  )}

                  {isRunning && (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => cancelTransfer(task.id)}
                      aria-label={t("common.cancel")}
                    >
                      <IconX className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {isRunning && (
                <Progress
                  value={pct}
                  aria-label={task.itemsSummary}
                  className="gap-1.5"
                />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
