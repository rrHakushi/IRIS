"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  ActivityFeed,
  ActivityPostComposer,
  type ActivityItem,
} from "@NamelessLiberty/borealis"
import { elysia } from "@/lib/elysia"
import { resolveUserId } from "@/lib/user-profile"

export interface ActivityTabProps {
  username: string
  userId?: string
  isOwner?: boolean
}

export function ActivityTab({
  username,
  userId,
  isOwner = false,
}: ActivityTabProps): React.JSX.Element {
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(
    userId
  )

  useEffect(() => {
    setResolvedUserId(userId)
  }, [userId])

  const fetchPage = useCallback(
    async (page: number, limit: number) => {
      let targetId = resolvedUserId
      if (!targetId) {
        targetId = (await resolveUserId(username)) || undefined
        if (targetId) {
          setResolvedUserId(targetId)
        }
      }

      if (!targetId) {
        return {
          activities: [] as ActivityItem[],
          pagination: { hasMore: false },
        }
      }

      const { data, error } = await elysia.carina
        .users({ userId: targetId })
        .activity.get({
          query: {
            page,
            limit,
          },
        })

      if (error || !data) {
        throw new Error(
          (error?.value as any)?.detail ||
            (error?.value as any)?.message ||
            "Failed to load profile activity"
        )
      }

      return {
        activities: (data.activities || []) as ActivityItem[],
        pagination: data.pagination,
      }
    },
    [resolvedUserId, username]
  )

  return (
    <ActivityFeed
      fetchPage={fetchPage}
      resetKey={resolvedUserId || username}
      limit={20}
      renderComposer={
        isOwner
          ? (prependItem) => <ActivityPostComposer onCreated={prependItem} />
          : undefined
      }
      emptyTitle="No activity recorded yet"
      emptyDescription={`@${username} doesn't have any activity logs recorded on their profile yet.`}
    />
  )
}
