import { tags } from "typia";

/**
 * A bulletin board article.
 *
 * Articles belong to a `section` (URL-safe slug). The server generates `id`
 * and `created_at`; everything else comes from the client on creation.
 *
 * @author Mohamed
 */
export interface IBbsArticle {
  /** Server-generated UUIDv4. Do not set on creation. */
  id: string & tags.Format<"uuid">;

  /** URL-safe section slug the article belongs to. */
  section: string & tags.Pattern<"^[a-z0-9-]+$">;

  /** Author's display name. */
  writer: string & tags.MinLength<1> & tags.MaxLength<50>;

  /** Headline shown in lists and the article header. */
  title: string & tags.MinLength<3> & tags.MaxLength<50>;

  /** Markdown body. May contain image references. */
  body: string;

  /** Optional thumbnail URL. Set to null to clear. */
  thumbnail: (string & tags.Format<"uri">) | null;

  /** ISO-8601 creation timestamp, set by the server. */
  created_at: string & tags.Format<"date-time">;

  /** ISO-8601 last-update timestamp, set by the server. */
  updated_at: string & tags.Format<"date-time">;
}

export namespace IBbsArticle {
  /**
   * Compact form returned in list endpoints.
   */
  export interface ISummary {
    id: string & tags.Format<"uuid">;
    section: string;
    writer: string;
    title: string;
    created_at: string & tags.Format<"date-time">;
  }

  /**
   * Payload accepted by `POST /bbs/:section/articles`.
   */
  export interface ICreate {
    /** Author's display name. */
    writer: string & tags.MinLength<1> & tags.MaxLength<50>;
    /** Headline shown in lists. */
    title: string & tags.MinLength<3> & tags.MaxLength<50>;
    /** Markdown body. */
    body: string;
    /** Optional thumbnail URL. */
    thumbnail: (string & tags.Format<"uri">) | null;
  }

  /**
   * Payload accepted by `PUT /bbs/:section/articles/:id`.
   * All fields optional; missing fields are left untouched.
   */
  export interface IUpdate extends Partial<ICreate> {}

  /**
   * Query string accepted by `GET /bbs/:section/articles`.
   */
  export interface IRequest {
    /** Page number (1-indexed). Defaults to 1. */
    page?: number & tags.Type<"uint32"> & tags.Minimum<1>;
    /** Page size (max 100). Defaults to 20. */
    limit?: number & tags.Type<"uint32"> & tags.Minimum<1> & tags.Maximum<100>;
    /** Free-text search across title and body. */
    search?: string;
  }
}

/**
 * Generic pagination envelope returned by list endpoints.
 */
export interface IPage<T> {
  /** Page contents. */
  data: T[];
  /** Pagination metadata. */
  pagination: IPage.IPagination;
}
export namespace IPage {
  export interface IPagination {
    /** Current page number (1-indexed). */
    current: number & tags.Type<"uint32"> & tags.Minimum<1>;
    /** Page size. */
    limit: number & tags.Type<"uint32"> & tags.Minimum<1>;
    /** Total record count across all pages. */
    records: number & tags.Type<"uint32">;
    /** Total page count. */
    pages: number & tags.Type<"uint32">;
  }
}
