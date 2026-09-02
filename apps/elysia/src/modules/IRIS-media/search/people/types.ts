import { t } from "elysia";

export const PeopleSearchResultSchema = t.Object({
  id: t.Number(),
  namePrimary: t.String(),
  nameNative: t.Nullable(t.String()),
  image: t.Nullable(t.String()),
  language: t.Nullable(t.String()),
});

export const PeopleSearchResponseSchema = t.Array(PeopleSearchResultSchema);

export interface PeopleSearchResultItem {
  id: number;
  namePrimary: string;
  nameNative: string | null;
  image: string | null;
  language: string | null;
}

export type PeopleSearchResponse = PeopleSearchResultItem[];
