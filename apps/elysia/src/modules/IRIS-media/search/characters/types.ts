import { t } from "elysia";

export const CharacterSearchResultSchema = t.Object({
  id: t.Number(),
  namePrimary: t.String(),
  nameNative: t.Nullable(t.String()),
  image: t.Nullable(t.String()),
  gender: t.Nullable(t.String()),
});

export const CharacterSearchResponseSchema = t.Array(CharacterSearchResultSchema);

export interface CharacterSearchResultItem {
  id: number;
  namePrimary: string;
  nameNative: string | null;
  image: string | null;
  gender: string | null;
}

export type CharacterSearchResponse = CharacterSearchResultItem[];
