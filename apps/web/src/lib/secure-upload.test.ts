import {
  assertSafeSvg,
  buildObjectStorageKey,
  detectMimeFromBuffer,
  sanitizeUploadFileName,
  validateSecureUpload
} from "./secure-upload";

describe("sanitizeUploadFileName", () => {
  it("strips path segments and dangerous characters", () => {
    expect(sanitizeUploadFileName("../../../etc/passwd")).toBe("passwd");
    expect(sanitizeUploadFileName("nice<script>.pdf")).toBe("nice_script_.pdf");
  });

  it("generates stable server-side object keys", () => {
    const a = buildObjectStorageKey(9, "doc.pdf");
    const b = buildObjectStorageKey(9, "doc.pdf");
    expect(a).toMatch(/^leads\/9\/[0-9a-f-]{36}-doc\.pdf$/);
    expect(b).not.toBe(a);
  });
});

describe("detectMimeFromBuffer", () => {
  it("detects pdf", () => {
    const buf = Buffer.from("%PDF-1.4\n%", "ascii");
    expect(detectMimeFromBuffer(buf)).toBe("application/pdf");
  });

  it("detects minimal mp4 / isom ftyp", () => {
    const buf = Buffer.concat([
      Buffer.from([0, 0, 0, 0x20]),
      Buffer.from("ftyp"),
      Buffer.from("isom"),
      Buffer.alloc(8, 0)
    ]);
    expect(detectMimeFromBuffer(buf)).toBe("video/mp4");
  });

  it("detects quicktime brand", () => {
    const buf = Buffer.concat([
      Buffer.from([0, 0, 0, 0x20]),
      Buffer.from("ftyp"),
      Buffer.from("qt  "),
      Buffer.alloc(8, 0)
    ]);
    expect(detectMimeFromBuffer(buf)).toBe("video/quicktime");
  });

  it("rejects avif ftyp as video", () => {
    const buf = Buffer.concat([
      Buffer.from([0, 0, 0, 0x20]),
      Buffer.from("ftyp"),
      Buffer.from("avif"),
      Buffer.alloc(8, 0)
    ]);
    expect(detectMimeFromBuffer(buf)).toBeNull();
  });

  it("detects webm ebml prefix", () => {
    const buf = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0xff, 0xff, 0xff]);
    expect(detectMimeFromBuffer(buf)).toBe("video/webm");
  });
});

describe("assertSafeSvg", () => {
  it("rejects script tags", () => {
    expect(assertSafeSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')).toBe(
      false
    );
    expect(assertSafeSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')).toBe(true);
  });
});

describe("validateSecureUpload", () => {
  it("rejects mime/content mismatch", () => {
    const pngSig = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00
    ]);
    const r = validateSecureUpload(pngSig, "image/jpeg", "x.png");
    expect(r.ok).toBe(false);
  });

  it("accepts mp4 with declared video/mp4", () => {
    const buf = Buffer.concat([
      Buffer.from([0, 0, 0, 0x20]),
      Buffer.from("ftyp"),
      Buffer.from("isom"),
      Buffer.alloc(8, 0)
    ]);
    const r = validateSecureUpload(buf, "video/mp4", "clip.mp4");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.mimeType).toBe("video/mp4");
  });

  it("allows quicktime sniff with browser-declared mp4 (mov vs mp4 mismatch)", () => {
    const buf = Buffer.concat([
      Buffer.from([0, 0, 0, 0x20]),
      Buffer.from("ftyp"),
      Buffer.from("qt  "),
      Buffer.alloc(8, 0)
    ]);
    const r = validateSecureUpload(buf, "video/mp4", "clip.mov");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.mimeType).toBe("video/quicktime");
  });

  it("respects maxBytes override for large uploads", () => {
    const buf = Buffer.alloc(5 * 1024 * 1024, 0xff);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    const fail = validateSecureUpload(buf, "image/jpeg", "big.jpg", { maxBytes: 1024 });
    expect(fail.ok).toBe(false);
    if (!fail.ok) expect(fail.error).toMatch(/too large/i);
  });
});
