import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import {
  IRISBitField,
  BitField,
  IRISFlags,
  DEFAULT_PERMISSIONS,
  hasPermission,
} from "../index";
import {
  RequirePermissions,
  Permissions,
  PERMISSIONS_KEY,
  PermissionsMetadata,
} from "../nestjs/permissions.decorator";
import {
  PermissionsGuard,
  RequestWithUser,
} from "../nestjs/permissions.guard";

describe("@IRIS/permissions", () => {
  describe("IRISFlags", () => {
    it("should define ADMINISTRATOR as a positive BigInt bitmask", () => {
      assert.strictEqual(typeof IRISFlags.ADMINISTRATOR, "bigint");
      assert.strictEqual(IRISFlags.ADMINISTRATOR, 1n << 0n);
    });

    it("should have empty DEFAULT_PERMISSIONS", () => {
      assert.deepStrictEqual(DEFAULT_PERMISSIONS, []);
    });
  });

  describe("IRISBitField", () => {
    it("should initialize an empty bitfield when no argument is given", () => {
      const bitfield = new IRISBitField();
      assert.deepStrictEqual(bitfield.raw, []);
      assert.strictEqual(bitfield.has(IRISFlags.ADMINISTRATOR), false);
    });

    it("should initialize an empty bitfield when null is passed", () => {
      const bitfield = new IRISBitField(null);
      assert.deepStrictEqual(bitfield.raw, []);
    });

    it("should initialize from raw integer array [1]", () => {
      const bitfield = IRISBitField.fromRaw([1]);
      assert.deepStrictEqual(bitfield.raw, [1]);
      assert.strictEqual(bitfield.has(IRISFlags.ADMINISTRATOR), true);
      assert.strictEqual(bitfield.has("ADMINISTRATOR"), true);
    });

    it("should initialize from BigInt", () => {
      const bitfield = IRISBitField.fromBigInt(IRISFlags.ADMINISTRATOR);
      assert.deepStrictEqual(bitfield.raw, [1]);
      assert.strictEqual(bitfield.has(IRISFlags.ADMINISTRATOR), true);
    });

    it("should add and remove ADMINISTRATOR permission", () => {
      const bitfield = new IRISBitField();
      assert.strictEqual(bitfield.has(IRISFlags.ADMINISTRATOR), false);

      bitfield.add(IRISFlags.ADMINISTRATOR);
      assert.deepStrictEqual(bitfield.raw, [1]);
      assert.strictEqual(bitfield.has(IRISFlags.ADMINISTRATOR), true);

      bitfield.remove(IRISFlags.ADMINISTRATOR);
      assert.deepStrictEqual(bitfield.raw, []);
      assert.strictEqual(bitfield.has(IRISFlags.ADMINISTRATOR), false);
    });

    it("should support toArray() returning active flag keys", () => {
      const bitfield = new IRISBitField([1]);
      assert.deepStrictEqual(bitfield.toArray(), ["ADMINISTRATOR"]);

      const empty = new IRISBitField();
      assert.deepStrictEqual(empty.toArray(), []);
    });

    it("should support toBigInt()", () => {
      const bitfield = new IRISBitField([1]);
      assert.strictEqual(bitfield.toBigInt(), 1n);

      const empty = new IRISBitField();
      assert.strictEqual(empty.toBigInt(), 0n);
    });

    it("should support clone() and equals()", () => {
      const bitfield1 = new IRISBitField([1]);
      const bitfield2 = bitfield1.clone();

      assert.strictEqual(bitfield1.equals(bitfield2), true);
      assert.strictEqual(bitfield1.equals([1]), true);
      assert.strictEqual(bitfield1.equals([]), false);
    });

    it("should support BitField alias", () => {
      const bitfield = new BitField([1]);
      assert.strictEqual(bitfield.has(BitField.Flags.ADMINISTRATOR), true);
    });

    it("should throw error when resolving invalid flag key string", () => {
      assert.throws(
        () => IRISBitField.resolve("INVALID_FLAG" as never),
        /Invalid permission flag key/,
      );
    });

    it("should throw error when resolving invalid non-positive bigint", () => {
      assert.throws(
        () => IRISBitField.resolve(0n),
        /must be a positive bigint/,
      );
    });
  });

  describe("hasPermission()", () => {
    it("should return false for null permissions", () => {
      assert.strictEqual(hasPermission(null, IRISFlags.ADMINISTRATOR), false);
      assert.strictEqual(hasPermission(null, "ADMINISTRATOR"), false);
    });

    it("should return false for empty array", () => {
      assert.strictEqual(hasPermission([], IRISFlags.ADMINISTRATOR), false);
    });

    it("should return true for [1] with ADMINISTRATOR", () => {
      assert.strictEqual(hasPermission([1], IRISFlags.ADMINISTRATOR), true);
      assert.strictEqual(hasPermission([1], "ADMINISTRATOR"), true);
      assert.strictEqual(hasPermission([1], [IRISFlags.ADMINISTRATOR]), true);
    });

    it("should support checkType 'any'", () => {
      assert.strictEqual(hasPermission([1], [IRISFlags.ADMINISTRATOR], "any"), true);
      assert.strictEqual(hasPermission([], [IRISFlags.ADMINISTRATOR], "any"), false);
    });
  });

  describe("NestJS Permissions Decorator & Guard", () => {
    it("should create metadata using @RequirePermissions / @Permissions", () => {
      class TestController {}
      RequirePermissions(IRISFlags.ADMINISTRATOR)(TestController);

      const metadata = Reflect.getMetadata(
        PERMISSIONS_KEY,
        TestController,
      ) as PermissionsMetadata;

      assert.ok(metadata);
      assert.deepStrictEqual(metadata.flags, [IRISFlags.ADMINISTRATOR]);
      assert.strictEqual(metadata.operator, "all");
    });

    it("should activate route when user has required permissions", () => {
      const reflector = new Reflector();
      const guard = new PermissionsGuard(reflector);

      const mockContext = {
        getHandler: () => () => {},
        getClass: () => class {},
        switchToHttp: () => ({
          getRequest: (): RequestWithUser => ({
            user: { permissions: [1] },
          }),
        }),
      } as unknown as ExecutionContext;

      reflector.getAllAndOverride = () => ({
        flags: [IRISFlags.ADMINISTRATOR],
        operator: "all",
      });

      assert.strictEqual(guard.canActivate(mockContext), true);
    });

    it("should deny route when user does not have required permissions", () => {
      const reflector = new Reflector();
      const guard = new PermissionsGuard(reflector);

      const mockContext = {
        getHandler: () => () => {},
        getClass: () => class {},
        switchToHttp: () => ({
          getRequest: (): RequestWithUser => ({
            user: { permissions: [] },
          }),
        }),
      } as unknown as ExecutionContext;

      reflector.getAllAndOverride = () => ({
        flags: [IRISFlags.ADMINISTRATOR],
        operator: "all",
      });

      assert.strictEqual(guard.canActivate(mockContext), false);
    });

    it("should deny route when user is null / unauthenticated", () => {
      const reflector = new Reflector();
      const guard = new PermissionsGuard(reflector);

      const mockContext = {
        getHandler: () => () => {},
        getClass: () => class {},
        switchToHttp: () => ({
          getRequest: (): RequestWithUser => ({
            user: null,
          }),
        }),
      } as unknown as ExecutionContext;

      reflector.getAllAndOverride = () => ({
        flags: [IRISFlags.ADMINISTRATOR],
        operator: "all",
      });

      assert.strictEqual(guard.canActivate(mockContext), false);
    });

    it("should allow route when no permission metadata is set", () => {
      const reflector = new Reflector();
      const guard = new PermissionsGuard(reflector);

      const mockContext = {
        getHandler: () => () => {},
        getClass: () => class {},
        switchToHttp: () => ({
          getRequest: (): RequestWithUser => ({
            user: null,
          }),
        }),
      } as unknown as ExecutionContext;

      reflector.getAllAndOverride = () => null;

      assert.strictEqual(guard.canActivate(mockContext), true);
    });
  });
});
