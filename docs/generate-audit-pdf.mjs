import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, "attendance-security-audit.html");
const pdfPath = resolve(__dirname, "Attendance-Security-Audit.pdf");

let puppeteer;
const webPuppeteer = resolve(__dirname, "../apps/web/node_modules/puppeteer");
try {
  puppeteer = (await import("puppeteer")).default;
} catch {
  if (existsSync(webPuppeteer)) {
    puppeteer = (await import(pathToFileURL(resolve(webPuppeteer, "index.js")).href)).default;
  } else {
    console.error("Puppeteer not found. Open attendance-security-audit.html in browser and Print to PDF.");
    process.exit(1);
  }
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
});
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0" });
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" }
});
await browser.close();
console.log("PDF created:", pdfPath);
