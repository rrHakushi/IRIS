import {
  IRISBitField,
  IRISFlags,
  DEFAULT_PERMISSIONS,
  hasPermission,
} from "./index";

/**
 * Demonstrates basic and advanced usage of `@IRIS/permissions`.
 */
function runDemo(): void {
  console.log("=== @IRIS/permissions Demo ===\n");

  // 1. Check Default Permissions
  console.log("1. Default Permissions:");
  console.log("DEFAULT_PERMISSIONS:", DEFAULT_PERMISSIONS);
  console.log("");

  // 2. Standard User (No Admin)
  console.log("2. Standard User Permissions (Empty array in DB):");
  const standardDbPermissions: number[] = [];
  console.log("Database user.permissions:", standardDbPermissions);
  console.log(
    "hasPermission(standard, ADMINISTRATOR):",
    hasPermission(standardDbPermissions, IRISFlags.ADMINISTRATOR),
  ); // false
  console.log("");

  // 3. Admin User (Int[] [1] in DB)
  console.log("3. Administrator User (DB permissions = [1]):");
  const adminDbPermissions: number[] = [1];
  console.log("Database user.permissions:", adminDbPermissions);
  console.log(
    "hasPermission(admin, ADMINISTRATOR):",
    hasPermission(adminDbPermissions, IRISFlags.ADMINISTRATOR),
  ); // true
  console.log(
    "hasPermission(admin, 'ADMINISTRATOR'):",
    hasPermission(adminDbPermissions, "ADMINISTRATOR"),
  ); // true
  console.log("");

  // 4. Null & Unauthenticated Safety
  console.log("4. Null / Unauthenticated Safety:");
  console.log(
    "hasPermission(null, ADMINISTRATOR):",
    hasPermission(null, IRISFlags.ADMINISTRATOR),
  ); // false
  console.log("");

  // 5. Using IRISBitField Object Directly
  console.log("5. IRISBitField Instance Operations:");
  const bitfield = new IRISBitField();
  console.log("Initial raw bits:", bitfield.raw); // []
  console.log("Has admin?", bitfield.has(IRISFlags.ADMINISTRATOR)); // false

  bitfield.add(IRISFlags.ADMINISTRATOR);
  console.log("After add(ADMINISTRATOR) raw bits:", bitfield.raw); // [1]
  console.log("Has admin?", bitfield.has("ADMINISTRATOR")); // true
  console.log("Granted flag keys:", bitfield.toArray()); // ['ADMINISTRATOR']

  bitfield.remove(IRISFlags.ADMINISTRATOR);
  console.log("After remove(ADMINISTRATOR) raw bits:", bitfield.raw); // []
  console.log("Has admin?", bitfield.has(IRISFlags.ADMINISTRATOR)); // false
  console.log("");

  console.log("=== Demo Completed Successfully ===");
}

runDemo();
