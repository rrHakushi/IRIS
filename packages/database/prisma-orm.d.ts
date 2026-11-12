declare module "@prisma/orm-postgres/config" {
  export interface PostgresConfigOptions {
    readonly contract: string | any;
    readonly output?: string;
    readonly db?: {
      readonly connection?: string;
    };
    readonly extensions?: readonly any[];
    readonly migrations?: {
      readonly dir?: string;
    };
  }

  export function defineConfig(options: PostgresConfigOptions): any;
  export function prisma7Schema(schemaPath: string): any;
}

