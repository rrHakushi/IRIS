import { Injectable, NotFoundException } from "@nestjs/common";
import typia from "typia";

import { IBbsArticle, IPage } from "./IBbsArticle";

/**
 * In-memory implementation of the bulletin board service.
 *
 * Replace with a real repository (Prisma, TypeORM, etc.) in production.
 * The point of this file is to keep the controller demo runnable.
 */
@Injectable()
export class BbsArticlesService {
  private readonly store = new Map<string, IBbsArticle>();

  async list(
    section: string,
    query: IBbsArticle.IRequest,
  ): Promise<IPage<IBbsArticle.ISummary>> {
    const limit = query.limit ?? 20;
    const current = query.page ?? 1;

    const all = Array.from(this.store.values()).filter(
      (a) =>
        a.section === section &&
        (query.search === undefined ||
          a.title.includes(query.search) ||
          a.body.includes(query.search)),
    );

    const records = all.length;
    const start = (current - 1) * limit;
    const data: IBbsArticle.ISummary[] = all
      .slice(start, start + limit)
      .map((a) => ({
        id: a.id,
        section: a.section,
        writer: a.writer,
        title: a.title,
        created_at: a.created_at,
      }));

    return {
      data,
      pagination: {
        current,
        limit,
        records,
        pages: Math.max(1, Math.ceil(records / limit)),
      },
    };
  }

  async findOrThrow(section: string, id: string): Promise<IBbsArticle> {
    const a = this.store.get(id);
    if (!a || a.section !== section)
      throw new NotFoundException({ code: "NOT_FOUND", message: `No article ${id} in ${section}` });
    return a;
  }

  async create(
    section: string,
    input: IBbsArticle.ICreate,
  ): Promise<IBbsArticle> {
    const now = new Date().toISOString() as string & typia.tags.Format<"date-time">;
    const article: IBbsArticle = {
      id: typia.random<string & typia.tags.Format<"uuid">>(),
      section: section as IBbsArticle["section"],
      writer: input.writer,
      title: input.title,
      body: input.body,
      thumbnail: input.thumbnail,
      created_at: now,
      updated_at: now,
    };
    this.store.set(article.id, article);
    return article;
  }

  async update(
    section: string,
    id: string,
    input: IBbsArticle.IUpdate,
  ): Promise<IBbsArticle> {
    const existing = await this.findOrThrow(section, id);
    const now = new Date().toISOString() as string & typia.tags.Format<"date-time">;
    const updated: IBbsArticle = {
      ...existing,
      ...input,
      updated_at: now,
    };
    this.store.set(id, updated);
    return updated;
  }

  async erase(section: string, id: string): Promise<void> {
    await this.findOrThrow(section, id);
    this.store.delete(id);
  }
}
