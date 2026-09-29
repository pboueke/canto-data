import * as canto from '../index';

describe('package root barrel', () => {
  test('exposes runtime values from every public subpath', () => {
    expect(canto.SCHEMA_VERSION).toBe('0.19.0');
    expect(canto.DEFAULT_JOURNAL_SETTINGS.sort).toBe('descending');
    expect(canto.CHUNKED_ATTACHMENT_CONTENT_FORMAT).toBe('canto-chunked-v1');
    expect(typeof canto.pageToPreview).toBe('function');
    expect(typeof canto.validateJournalContent).toBe('function');
    expect(typeof canto.isChunkedAttachmentContent).toBe('function');
    expect(typeof canto.validateChunkedAttachmentContent).toBe('function');
    expect(typeof canto.migrateIfNeeded).toBe('function');
    expect(typeof canto.parseManifest).toBe('function');
  });

  test('re-exports every runtime binding without undefined holes', () => {
    const entries = Object.entries(canto);
    expect(entries.length).toBeGreaterThan(20);
    for (const [name, value] of entries) {
      expect(name).toBeTruthy();
      expect(value).toBeDefined();
    }
  });
});
