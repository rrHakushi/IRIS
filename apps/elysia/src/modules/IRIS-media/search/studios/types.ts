import { t } from "elysia";

export const StudioSearchResultSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  isAnimationStudio: t.Boolean(),
});

export const StudioSearchResponseSchema = t.Array(StudioSearchResultSchema);

export interface StudioSearchResultItem {
  id: number;
  name: string;
  isAnimationStudio: boolean;
}

export type StudioSearchResponse = StudioSearchResultItem[];
