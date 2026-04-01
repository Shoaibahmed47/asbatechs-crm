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
});
