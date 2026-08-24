import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from './cache.constants.js';

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
export const InjectCache = (): ReturnType<typeof Inject> => Inject(CACHE_MANAGER);
