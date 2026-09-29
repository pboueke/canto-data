import type { Migration } from "../migration";

/** Generation is additive; existing chunk descriptors retain legacy addressing. */
export const v0_18_0_to_v0_19_0: Migration = {
  from: "0.18.0",
  to: "0.19.0",
  description: "Additive chunked attachment remote generation metadata",
  migrate(data: unknown): unknown {
    return data;
  },
};
