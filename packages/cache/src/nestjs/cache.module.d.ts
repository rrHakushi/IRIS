import { type DynamicModule, type ModuleMetadata, type Type } from '@nestjs/common';
import type { CacheOptions } from '../types.js';
/**
 * Options for configuring CacheModule synchronously.
 */
export interface CacheModuleOptions extends CacheOptions {
    /**
     * If true, registers the module globally across all NestJS modules.
     * @default true
     */
    isGlobal?: boolean;
}
/**
 * Interface implemented by classes that dynamically create CacheOptions.
 */
export interface CacheOptionsFactory {
    /**
     * Creates CacheOptions instance.
     */
    createCacheOptions(): Promise<CacheOptions> | CacheOptions;
}
/**
 * Permissible types for factory arguments in async provider configurations.
 */
export type CacheFactoryArg = object | string | number | boolean | symbol | Function;
/**
 * Permissible injection tokens for NestJS DI.
 */
export type CacheInjectionToken = string | symbol | Type<object> | Function;
/**
 * Options for configuring CacheModule asynchronously (e.g. loading from ConfigService).
 */
export interface CacheModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    /**
     * If true, registers the module globally across all NestJS modules.
     * @default true
     */
    isGlobal?: boolean;
    /**
     * Existing provider to reuse for creating options.
     */
    useExisting?: Type<CacheOptionsFactory>;
    /**
     * Class provider to instantiate for creating options.
     */
    useClass?: Type<CacheOptionsFactory>;
    /**
     * Factory function that returns CacheOptions.
     */
    useFactory?: (...args: CacheFactoryArg[]) => Promise<CacheOptions> | CacheOptions;
    /**
     * Providers to inject into the useFactory function.
     */
    inject?: CacheInjectionToken[];
}
/**
 * NestJS dynamic module for `@IRIS/cache`.
 * Provides `CacheService` and `CACHE_MANAGER` tokens.
 *
 * @example Synchronous registration
 * ```typescript
 * @Module({
 *   imports: [
 *     CacheModule.forRoot({
 *       isGlobal: true,
 *       defaultTtlSeconds: 300,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * @example Asynchronous registration
 * ```typescript
 * @Module({
 *   imports: [
 *     CacheModule.forRootAsync({
 *       isGlobal: true,
 *       imports: [ConfigModule],
 *       useFactory: (config: ConfigService) => ({
 *         redis: { url: config.get<string>('REDIS_URL') },
 *       }),
 *       inject: [ConfigService],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
export declare class CacheModule {
    /**
     * Synchronously configure and register the CacheModule.
     * @param options - Cache module configuration options
     * @returns DynamicModule definition
     */
    static forRoot(options?: CacheModuleOptions): DynamicModule;
    /**
     * Asynchronously configure and register the CacheModule (e.g. loading config from ConfigService).
     * @param options - Async configuration options
     * @returns DynamicModule definition
     */
    static forRootAsync(options: CacheModuleAsyncOptions): DynamicModule;
    /**
     * Helper to create async providers based on useFactory / useClass / useExisting.
     * @param options - Async options
     * @returns Array of providers
     */
    private static createAsyncProviders;
}
