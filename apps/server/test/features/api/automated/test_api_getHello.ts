import typia from "typia";
import type { Primitive } from "typia";

import api from "../../../../../../packages/api";

export const test_api_getHello = async (connection: api.IConnection) => {
  const output: Primitive<string> = await api.functional.getHello(connection);
  typia.assert(output);
};
