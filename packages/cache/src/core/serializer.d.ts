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
export declare class JsonSerializer implements ISerializer {
    /**
     * Serializes a value to a JSON string.
     * @template T - Value type
     * @param value - Value to serialize
     * @returns String representation in JSON format
     * @throws {SerializationError} If stringification fails (e.g. Circular structures)
     */
    serialize<T = SerializableValue>(value: T): string;
    /**
     * Deserializes a JSON string into the target type.
     * @template T - Expected output type
     * @param raw - JSON string
     * @returns Deserialized JavaScript object or primitive
     * @throws {SerializationError} If parsing fails
     */
    deserialize<T = SerializableValue>(raw: string): T;
}
/**
 * Global default JSON serializer singleton instance.
 */
export declare const defaultSerializer: JsonSerializer;
