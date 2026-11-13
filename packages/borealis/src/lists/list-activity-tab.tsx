"use client"

import React, { useCallback, useEffect, useState } from "react"
import { elysia } from "@/lib/elysia"
import { resolveUserId } from "@/lib/user-profile"
import { ActivityFeed, type ActivityItem } from "../activity"
import type { MediaListType } from "./types"

export interface ListActivityTabProps {
  username: string
  userId?: string
  mediaType: MediaListType
  isOwner?: boolean
}

export function ListActivityTab({
  username,
  userId,
  mediaType,
}: ListActivityTabProps): React.JSX.Element {
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
        targetId = (await resolveUserId(username)) ?? undefined
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
        .activity({ category: mediaType })
        .get({
          query: {
            page,
            limit,
          },
        })

      if (error || !data) {
        throw new Error(
          (error?.value as any)?.detail ||
            (error?.value as any)?.message ||
            "Failed to load list activity"
        )
      }

      return {
        activities: (data.activities || []) as ActivityItem[],
        pagination: data.pagination,
      }
    },
    [resolvedUserId, username, mediaType]
  )

  return (
    <ActivityFeed
      fetchPage={fetchPage}
      resetKey={`${mediaType}:${resolvedUserId || username}`}
      limit={20}
      emptyTitle={`No ${mediaType.toLowerCase()} activity yet`}
      emptyDescription={`Updates and changes to @${username}'s ${mediaType.toLowerCase()} list will appear here.`}
    />
  )
}
