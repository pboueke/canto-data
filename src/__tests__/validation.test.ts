import {
  ValidationError,
  isGeoLocation,
  isComment,
  isAttachment,
  isChunkedAttachmentContent,
  isPage,
  isJournal,
  isJournalContent,
  validateGeoLocation,
  validateComment,
  validateAttachment,
  validateChunkedAttachmentContent,
  validatePage,
  validateJournalSettings,
  validateJournal,
  validateJournalContent,
} from "../validation";
import {
  CHUNKED_ATTACHMENT_CONTENT_FORMAT,
  DEFAULT_JOURNAL_SETTINGS,
} from "../types";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeGeoLocation() {
  return { latitude: 40.7128, longitude: -74.006, altitude: 10, accuracy: 5 };
}

function makeComment() {
  return { id: "c1", text: "A comment", date: "2026-01-01T00:00:00.000Z" };
}

function makeChunkedContent(overrides?: Partial<Record<string, unknown>>) {
  return {
    format: CHUNKED_ATTACHMENT_CONTENT_FORMAT,
    byteLength: 5,
    chunkSize: 2,
    chunkCount: 3,
    ...overrides,
  };
}

function makeAttachment(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "a1",
    path: "/path/to/file.jpg",
    name: "file.jpg",
    type: "image",
    encrypted: false,
    deleted: false,
    ...overrides,
  };
}

function makePage(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "p1",
    text: "Hello world",
    date: "2026-01-01T00:00:00.000Z",
    tags: ["tag1"],
    files: [],
    images: [],
    comments: [],
    modified: Date.now(),
    deleted: false,
    ...overrides,
  };
}

function makeJournal() {
  return {
    id: "j1",
    title: "My Journal",
    icon: "📔",
    date: "2026-01-01T00:00:00.000Z",
    secure: false,
  };
}

function makeJournalContent() {
  return {
    ...makeJournal(),
    pages: [makePage()],
    settings: { ...DEFAULT_JOURNAL_SETTINGS },
    schemaVersion: "1.0.0",
    version: 1,
  };
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

describe("type guards", () => {
  test("isGeoLocation accepts valid location", () => {
    expect(isGeoLocation(makeGeoLocation())).toBe(true);
  });

  test("isGeoLocation rejects non-object", () => {
    expect(isGeoLocation(null)).toBe(false);
    expect(isGeoLocation("string")).toBe(false);
  });

  test("isComment accepts valid comment", () => {
    expect(isComment(makeComment())).toBe(true);
  });

  test("isComment rejects missing fields", () => {
    expect(isComment({ id: "c1", text: "A comment" })).toBe(false);
  });

  test("isComment rejects non-object", () => {
    expect(isComment(null)).toBe(false);
    expect(isComment("string")).toBe(false);
  });

  test("isAttachment accepts valid legacy and chunked attachments", () => {
    expect(isAttachment(makeAttachment())).toBe(true);
    expect(
      isAttachment(makeAttachment({ content: makeChunkedContent() })),
    ).toBe(true);
  });

  test("isChunkedAttachmentContent accepts a valid descriptor", () => {
    expect(isChunkedAttachmentContent(makeChunkedContent())).toBe(true);
  });

  test("isChunkedAttachmentContent rejects malformed descriptors", () => {
    expect(isChunkedAttachmentContent(null)).toBe(false);
    expect(isChunkedAttachmentContent([])).toBe(false);
    expect(
      isChunkedAttachmentContent(makeChunkedContent({ format: "unknown" })),
    ).toBe(false);
    expect(
      isChunkedAttachmentContent(makeChunkedContent({ byteLength: -1 })),
    ).toBe(false);
    expect(
      isChunkedAttachmentContent(makeChunkedContent({ chunkSize: 0 })),
    ).toBe(false);
    expect(
      isChunkedAttachmentContent(makeChunkedContent({ chunkCount: 2 })),
    ).toBe(false);
  });

  test("isAttachment rejects malformed content", () => {
    expect(isAttachment(makeAttachment({ content: "not-an-object" }))).toBe(
      false,
    );
  });

  test("isAttachment rejects non-object", () => {
    expect(isAttachment(null)).toBe(false);
    expect(isAttachment("string")).toBe(false);
  });

  test("isAttachment rejects invalid type enum", () => {
    expect(isAttachment(makeAttachment({ type: "video" }))).toBe(false);
  });

  test("isPage accepts valid page", () => {
    expect(isPage(makePage())).toBe(true);
  });

  test("isPage rejects non-object", () => {
    expect(isPage(null)).toBe(false);
    expect(isPage("string")).toBe(false);
  });

  test("isPage rejects missing arrays", () => {
    expect(isPage({ ...makePage(), tags: "not-array" })).toBe(false);
  });

  test("isJournal accepts valid journal", () => {
    expect(isJournal(makeJournal())).toBe(true);
  });

  test("isJournal rejects non-object", () => {
    expect(isJournal(null)).toBe(false);
    expect(isJournal("string")).toBe(false);
  });

  test("isJournal rejects missing secure", () => {
    const { secure: _secure, ...rest } = makeJournal();
    expect(isJournal(rest)).toBe(false);
  });

  test("isJournalContent accepts valid journal content", () => {
    expect(isJournalContent(makeJournalContent())).toBe(true);
  });

  test("isJournalContent rejects non-journal", () => {
    expect(isJournalContent(null)).toBe(false);
    expect(isJournalContent("string")).toBe(false);
  });

  test("isJournalContent rejects missing pages", () => {
    const { pages: _pages, ...rest } = makeJournalContent();
    expect(isJournalContent(rest)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Structural validators
// ---------------------------------------------------------------------------

describe("structural validators", () => {
  test("validateGeoLocation passes valid location", () => {
    expect(validateGeoLocation(makeGeoLocation())).toEqual(makeGeoLocation());
  });

  test("validateGeoLocation rejects string latitude", () => {
    expect(() =>
      validateGeoLocation({ latitude: "40", longitude: -74 }),
    ).toThrow(ValidationError);
  });

  test("validateComment passes valid comment", () => {
    expect(validateComment(makeComment())).toEqual(makeComment());
  });

  test("validateAttachment rejects invalid type enum", () => {
    try {
      validateAttachment(makeAttachment({ type: "video" }));
      fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).field).toBe("attachment.type");
      expect((err as ValidationError).expected).toContain("image");
    }
  });

  test("validateAttachment allows optional size and valid chunked content", () => {
    expect(validateAttachment(makeAttachment({ size: 1024 }))).toBeDefined();
    expect(validateAttachment(makeAttachment())).toBeDefined();
    expect(
      validateAttachment(makeAttachment({ content: makeChunkedContent() })),
    ).toBeDefined();
  });

  test("validateChunkedAttachmentContent accepts an empty attachment", () => {
    expect(
      validateChunkedAttachmentContent(
        makeChunkedContent({ byteLength: 0, chunkSize: 1, chunkCount: 0 }),
      ),
    ).toBeDefined();
  });

  test("validateChunkedAttachmentContent reports malformed descriptor paths", () => {
    const invalidDescriptors = [
      [makeChunkedContent({ format: "unknown" }), "content.format"],
      ["not-an-object", "content"],
      [makeChunkedContent({ byteLength: 1.5 }), "content.byteLength"],
      [
        makeChunkedContent({ byteLength: Number.MAX_SAFE_INTEGER + 1 }),
        "content.byteLength",
      ],
      [makeChunkedContent({ byteLength: -1 }), "content.byteLength"],
      [makeChunkedContent({ chunkSize: 0 }), "content.chunkSize"],
      [makeChunkedContent({ chunkSize: -1 }), "content.chunkSize"],
      [makeChunkedContent({ chunkSize: 1.5 }), "content.chunkSize"],
      [
        makeChunkedContent({ chunkSize: Number.MAX_SAFE_INTEGER + 1 }),
        "content.chunkSize",
      ],
      [makeChunkedContent({ chunkCount: 1.5 }), "content.chunkCount"],
      [makeChunkedContent({ chunkCount: -1 }), "content.chunkCount"],
      [
        makeChunkedContent({ chunkCount: Number.MAX_SAFE_INTEGER + 1 }),
        "content.chunkCount",
      ],
      [makeChunkedContent({ chunkCount: 2 }), "content.chunkCount"],
      [
        makeChunkedContent({ byteLength: 0, chunkSize: 2, chunkCount: 1 }),
        "content.chunkCount",
      ],
    ];

    for (const [descriptor, field] of invalidDescriptors) {
      try {
        validateChunkedAttachmentContent(descriptor);
        fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).field).toBe(field);
      }
    }
  });

  test("validateAttachment reports a nested content path", () => {
    try {
      validateAttachment(
        makeAttachment({ content: makeChunkedContent({ chunkCount: 2 }) }),
        "item",
      );
      fail("should have thrown");
    } catch (err) {
      expect((err as ValidationError).field).toBe("item.content.chunkCount");
    }
  });

  test("validatePage validates nested attachments", () => {
    const page = makePage({
      images: [makeAttachment({ type: "badtype" })],
    });
    expect(() => validatePage(page)).toThrow(ValidationError);
  });

  test("validatePage validates nested file attachments", () => {
    const page = makePage({
      files: [makeAttachment({ type: "file" })],
    });
    expect(validatePage(page)).toBeDefined();
  });

  test("validatePage retains nested image and file content paths", () => {
    const imagePage = makePage({
      images: [
        makeAttachment({ content: makeChunkedContent({ chunkCount: 2 }) }),
      ],
    });
    const filePage = makePage({
      files: [
        makeAttachment({
          type: "file",
          content: makeChunkedContent({ chunkSize: 0 }),
        }),
      ],
    });

    expect(() => validatePage(imagePage)).toThrow(
      expect.objectContaining({ field: "page.images[0].content.chunkCount" }),
    );
    expect(() => validatePage(filePage)).toThrow(
      expect.objectContaining({ field: "page.files[0].content.chunkSize" }),
    );
  });

  test("validatePage rejects invalid file attachment", () => {
    const page = makePage({
      files: [makeAttachment({ type: "badtype" })],
    });
    expect(() => validatePage(page)).toThrow(ValidationError);
  });

  test("validatePage validates nested comments", () => {
    const page = makePage({
      comments: [{ id: "c1", text: 123 }],
    });
    expect(() => validatePage(page)).toThrow(ValidationError);
  });

  test("validatePage validates tag types", () => {
    const page = makePage({ tags: [123] });
    expect(() => validatePage(page)).toThrow(ValidationError);
  });

  test("validatePage passes with optional location", () => {
    const page = makePage({ location: makeGeoLocation() });
    expect(validatePage(page)).toBeDefined();
  });

  test("validatePage passes with null location", () => {
    const page = makePage({ location: null });
    expect(validatePage(page)).toBeDefined();
  });

  test("validateJournalSettings validates sort enum", () => {
    expect(() =>
      validateJournalSettings({ ...DEFAULT_JOURNAL_SETTINGS, sort: "random" }),
    ).toThrow(ValidationError);
  });

  test("validateJournalSettings validates syncProvider enum", () => {
    expect(() =>
      validateJournalSettings({
        ...DEFAULT_JOURNAL_SETTINGS,
        syncProvider: "dropbox",
      }),
    ).toThrow(ValidationError);
  });

  test("validateJournal passes with optional fields", () => {
    const journal = {
      ...makeJournal(),
      salt: "abc123",
      biometric: true,
      kdfIterations: 50000,
      themeOverride: "dark",
    };
    expect(validateJournal(journal)).toBeDefined();
  });

  test("validateJournalContent validates all pages recursively", () => {
    const content = makeJournalContent();
    content.pages = [
      makePage(),
      { ...makePage(), id: "p2", deleted: "not-bool" } as never,
    ];
    expect(() => validateJournalContent(content)).toThrow(ValidationError);
  });

  test("validateJournalContent passes without schemaVersion (legacy)", () => {
    const content = makeJournalContent();
    delete (content as Record<string, unknown>).schemaVersion;
    expect(validateJournalContent(content)).toBeDefined();
  });

  test("ValidationError contains field path", () => {
    const page = makePage({ images: [makeAttachment({ encrypted: "yes" })] });
    try {
      validatePage(page, "pages[0]");
      fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).field).toBe(
        "pages[0].images[0].encrypted",
      );
    }
  });

  test("validatePage rejects non-object", () => {
    expect(() => validatePage(null)).toThrow(ValidationError);
    expect(() => validatePage("string")).toThrow(ValidationError);
  });

  test("validateJournalContent passes empty pages", () => {
    const content = { ...makeJournalContent(), pages: [] };
    expect(validateJournalContent(content)).toBeDefined();
  });

  test("validatePage rejects NaN modified timestamp", () => {
    const page = makePage({ modified: NaN });
    expect(() => validatePage(page)).toThrow(ValidationError);
  });

  test("validatePage rejects Infinity modified timestamp", () => {
    const page = makePage({ modified: Infinity });
    expect(() => validatePage(page)).toThrow(ValidationError);
  });

  test("validatePage rejects -Infinity modified timestamp", () => {
    const page = makePage({ modified: -Infinity });
    expect(() => validatePage(page)).toThrow(ValidationError);
  });

  test("validateGeoLocation rejects NaN latitude", () => {
    expect(() =>
      validateGeoLocation({ latitude: NaN, longitude: -74.006 }),
    ).toThrow(ValidationError);
  });

  test("validateGeoLocation rejects Infinity longitude", () => {
    expect(() =>
      validateGeoLocation({ latitude: 40.7, longitude: Infinity }),
    ).toThrow(ValidationError);
  });

  test("validateGeoLocation rejects latitude > 90", () => {
    expect(() => validateGeoLocation({ latitude: 91, longitude: 0 })).toThrow(
      ValidationError,
    );
  });

  test("validateGeoLocation rejects latitude < -90", () => {
    expect(() => validateGeoLocation({ latitude: -91, longitude: 0 })).toThrow(
      ValidationError,
    );
  });

  test("validateGeoLocation rejects longitude > 180", () => {
    expect(() => validateGeoLocation({ latitude: 0, longitude: 181 })).toThrow(
      ValidationError,
    );
  });

  test("validateGeoLocation rejects longitude < -180", () => {
    expect(() => validateGeoLocation({ latitude: 0, longitude: -181 })).toThrow(
      ValidationError,
    );
  });

  test("validateGeoLocation accepts lat=-90 (edge)", () => {
    expect(validateGeoLocation({ latitude: -90, longitude: 0 })).toBeDefined();
  });

  test("validateGeoLocation accepts lat=90 (edge)", () => {
    expect(validateGeoLocation({ latitude: 90, longitude: 0 })).toBeDefined();
  });

  test("validateGeoLocation accepts lon=-180 (edge)", () => {
    expect(validateGeoLocation({ latitude: 0, longitude: -180 })).toBeDefined();
  });

  test("validateGeoLocation accepts lon=180 (edge)", () => {
    expect(validateGeoLocation({ latitude: 0, longitude: 180 })).toBeDefined();
  });

  test("validatePage rejects empty string tag", () => {
    const page = makePage({ tags: [""] });
    expect(() => validatePage(page)).toThrow(ValidationError);
  });

  test("validatePage rejects whitespace-only tag", () => {
    const page = makePage({ tags: ["   "] });
    expect(() => validatePage(page)).toThrow(ValidationError);
  });

  test("validatePage rejects tab-only tag", () => {
    const page = makePage({ tags: ["\t"] });
    expect(() => validatePage(page)).toThrow(ValidationError);
  });

  test("validatePage accepts non-empty tag", () => {
    const page = makePage({ tags: ["valid"] });
    expect(validatePage(page)).toBeDefined();
  });
});
