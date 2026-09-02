import { t } from "elysia";

export const TvSearchResultSchema = t.Object({
  id: t.Number(),
  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  titleNative: t.Nullable(t.String()),
  coverImage: t.Nullable(t.String()),
  firstAiredYear: t.Nullable(t.Number()),
});

export const TvSearchResponseSchema = t.Array(TvSearchResultSchema);

export interface TvSearchResultItem {
  id: number;
  titlePrimary: string;
  titleSecondary: string | null;
  titleNative: string | null;
  coverImage: string | null;
  firstAiredYear: number | null;
}

export type TvSearchResponse = TvSearchResultItem[];
