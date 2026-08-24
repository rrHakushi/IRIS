import { Inject } from '@nestjs/common';
/**
 * Parameter decorator to inject the `CacheManager` instance into NestJS constructors.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class AppService {
 *   constructor(
 *     @InjectCache() private readonly cache: CacheManager,
 *   ) {}
 * }
 * ```
 */
export declare const InjectCache: () => ReturnType<typeof Inject>;
