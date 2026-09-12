"use client"

import React from "react"
import Link from "next/link"
import { IconPhotoOff } from "@tabler/icons-react"
import type { StaffMemberItem } from "../media-types"

interface StaffTabProps {
  staff: StaffMemberItem[]
}

export function StaffTab({ staff }: StaffTabProps) {
  if (staff.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No staff information available for this title.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Staff ({staff.length})
        </h2>
      </div>

      {/* Natural order staff grid without artificial sorting */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {staff.map((member) => {
          const roleLabel =
            member.customRole ||
            (member.role
              ? member.role
                  .split("_")
                  .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
                  .join(" ")
              : "Staff")

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-2.5"
            >
              <Link
                href={`/IRIS-list/people/${member.person.id}`}
                className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {member.person.image ? (
                  <img
                    src={member.person.image}
                    alt={member.person.namePrimary}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                    <IconPhotoOff className="size-4" aria-hidden="true" />
                  </div>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/IRIS-list/people/${member.person.id}`}
                  className="truncate text-xs font-semibold text-foreground outline-none hover:underline focus-visible:underline"
                >
                  {member.person.namePrimary}
                </Link>
                {member.person.nameNative && (
                  <span className="font-japanese truncate text-[10px] text-muted-foreground opacity-75">
                    {member.person.nameNative}
                  </span>
                )}
                <span className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {roleLabel}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
