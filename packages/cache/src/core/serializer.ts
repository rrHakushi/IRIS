import { SerializationError } from '../errors.js';
import type { SerializableValue } from '../types.js';

/**
 * Standard serializer interface for transforming in-memory objects to and from strings.
 */
export interface ISerializer {
  /**
   * Serialize a JavaScript value into a string.
   * @template T - Value type
   * @param value - Value to serialize
   * @returns String representation
   * @throws {SerializationError} When serialization fails
   */
  serialize<T = SerializableValue>(value: T): string;

  /**
   * Deserialize a raw string back into a typed JavaScript value.
   * @template T - Return type
   * @param raw - String to deserialize
   * @returns Deserialized JavaScript value
   * @throws {SerializationError} When parsing fails
   */
  deserialize<T = SerializableValue>(raw: string): T;
}

/**
 * Safe JSON serializer supporting standard types, primitives, and composite objects.
 */
export class JsonSerializer implements ISerializer {
  /**
   * Serializes a value to a JSON string.
   * @template T - Value type
   * @param value - Value to serialize
   * @returns String representation in JSON format
   * @throws {SerializationError} If stringification fails (e.g. Circular structures)
   */
  public serialize<T = SerializableValue>(value: T): string {
    if (value === undefined) {
      return JSON.stringify(null);
    }
    try {
      return JSON.stringify(value);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown serialization failure';
      throw new SerializationError(`Failed to serialize cache value to JSON: ${message}`, message);
    }
  }

  /**
   * Deserializes a JSON string into the target type.
   * @template T - Expected output type
   * @param raw - JSON string
   * @returns Deserialized JavaScript object or primitive
   * @throws {SerializationError} If parsing fails
   */
  public deserialize<T = SerializableValue>(raw: string): T {
    if (raw === null || raw === undefined) {
      return null as T;
    }
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON input';
      throw new SerializationError(
        `Failed to deserialize JSON value "${raw.slice(0, 100)}": ${message}`,
        message,
      );
    }
  }
}

/**
 * Global default JSON serializer singleton instance.
 */
export const defaultSerializer = new JsonSerializer();
