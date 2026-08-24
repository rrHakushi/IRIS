import {
  TypedBody,
  TypedException,
  TypedParam,
  TypedQuery,
  TypedRoute,
} from "@nestia/core";
import { Controller } from "@nestjs/common";
import type { tags } from "typia";
import { TypeGuardError } from "typia";

import { IBbsArticle, IPage } from "./IBbsArticle";
import { BbsArticlesService } from "./BbsArticlesService";

/**
 * Bulletin board articles, scoped by section.
 *
 * Demonstrates every common @nestia/core decorator:
 *   - @TypedRoute.* for typed responses
 *   - @TypedParam for path parameters
 *   - @TypedQuery for query strings
 *   - @TypedBody for JSON bodies
 *   - @TypedException for declared error types
 *
 * @tag articles
 */
@Controller("bbs/:section/articles")
export class BbsArticlesController {
  constructor(private readonly service: BbsArticlesService) {}

  /**
   * List articles in a section, paginated.
   *
   * @param section URL-safe section slug.
   * @param query Pagination and search options.
   * @returns Paginated list of article summaries.
   */
  @TypedRoute.Get()
  async index(
    @TypedParam("section") section: string,
    @TypedQuery() query: IBbsArticle.IRequest,
  ): Promise<IPage<IBbsArticle.ISummary>> {
    return this.service.list(section, query);
  }

  /**
   * Get a single article by ID.
   *
   * @param section Section the article belongs to.
   * @param id Article ID (UUIDv4).
   * @returns The full article record.
   */
  @TypedException<INotFound>(404, "Article not found")
  @TypedRoute.Get(":id")
  async at(
    @TypedParam("section") section: string,
    @TypedParam("id") id: string & tags.Format<"uuid">,
  ): Promise<IBbsArticle> {
    return this.service.findOrThrow(section, id);
  }

  /**
   * Create a new article in a section.
   *
   * @param section Target section slug.
   * @param input Article fields.
   * @returns The created article, including server-generated id and timestamps.
   *
   * @security bearer
   */
  @TypedException<TypeGuardError.IProps>(400, "Validation failure")
  @TypedRoute.Post()
  async create(
    @TypedParam("section") section: string,
    @TypedBody() input: IBbsArticle.ICreate,
  ): Promise<IBbsArticle> {
    return this.service.create(section, input);
  }

  /**
   * Update an existing article.
   *
   * @param section Section the article belongs to.
   * @param id Article ID.
   * @param input Fields to update (all optional).
   * @returns The updated article.
   *
   * @security bearer
   */
  @TypedException<TypeGuardError.IProps>(400, "Validation failure")
  @TypedException<INotFound>(404, "Article not found")
  @TypedRoute.Put(":id")
  async update(
    @TypedParam("section") section: string,
    @TypedParam("id") id: string & tags.Format<"uuid">,
    @TypedBody() input: IBbsArticle.IUpdate,
  ): Promise<IBbsArticle> {
    return this.service.update(section, id, input);
  }

  /**
   * Delete an article.
   *
   * @param section Section the article belongs to.
   * @param id Article ID.
   *
   * @security bearer
   */
  @TypedException<INotFound>(404, "Article not found")
  @TypedRoute.Delete(":id")
  async erase(
    @TypedParam("section") section: string,
    @TypedParam("id") id: string & tags.Format<"uuid">,
  ): Promise<void> {
    await this.service.erase(section, id);
  }
}

/** Standard not-found error shape returned by 404 endpoints. */
export interface INotFound {
  /** Always "NOT_FOUND". */
  code: "NOT_FOUND";
  /** Human-readable message. */
  message: string;
}
