import { toWelcomeFirstName } from "./workspace-welcome";

describe("toWelcomeFirstName", () => {
  it("uses first word of a real name", () => {
    expect(toWelcomeFirstName("Shoaib Ahmed", "shoaib@test.com")).toBe("Shoaib");
  });

  it("does not use a full email stored as name", () => {
    expect(toWelcomeFirstName("shoaibhere47@gmail.com", "shoaibhere47@gmail.com")).toBe(
      "Shoaibhere"
    );
  });

  it("derives a readable name from email when profile name is missing", () => {
    expect(toWelcomeFirstName("", "shoaib.ahmed@company.com")).toBe("Shoaib");
  });

  it("falls back safely", () => {
    expect(toWelcomeFirstName(null, null)).toBe("there");
  });
});
