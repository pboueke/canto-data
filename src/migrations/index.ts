import type { Migration } from "../migration";
import { v0_16_0_to_v0_17_0 } from "./v0_16_0_to_v0_17_0";
import { v0_17_0_to_v0_18_0 } from "./v0_17_0_to_v0_18_0";
import { v0_18_0_to_v0_19_0 } from "./v0_18_0_to_v0_19_0";

/**
 * Registry of all schema migrations, ordered from oldest to newest.
 */
export const MIGRATIONS: Migration[] = [
  v0_16_0_to_v0_17_0,
  v0_17_0_to_v0_18_0,
  v0_18_0_to_v0_19_0,
];
