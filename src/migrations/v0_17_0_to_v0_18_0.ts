import type { Migration } from "../migration";

/**
 * Migration from schema v0.17.0 to v0.18.0.
 *
 * Attachment content descriptors are additive. Legacy attachment data stays
 * descriptor-absent; this package does not convert attachment bytes or storage.
 */
export const v0_17_0_to_v0_18_0: Migration = {
  from: "0.17.0",
  to: "0.18.0",
  description: "Additive chunked attachment-content descriptor schema",
  migrate(data: unknown): unknown {
    return data;
  },
};
