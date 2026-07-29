import { app } from "electron";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import type { ActivityEvent } from "../shared/types";

export type AttendanceEventPayload = {
  event: ActivityEvent;
  source: "electron";
  awayCause?: string;
  observedAt: string;
  clientEventId: string;
};

export type QueuedAttendanceEvent = {
  id: string;
  createdAt: string;
  payload: AttendanceEventPayload;
};

export class AttendanceEventQueue {
  private filePath: string;
  private loaded = false;
  private entries: QueuedAttendanceEvent[] = [];

  constructor() {
    this.filePath = path.join(app.getPath("userData"), "attendance-event-queue.json");
  }

  enqueue(payload: Omit<AttendanceEventPayload, "clientEventId">): QueuedAttendanceEvent | null {
    this.load();
    const id = randomUUID();
    const entry: QueuedAttendanceEvent = {
      id,
      createdAt: new Date().toISOString(),
      payload: { ...payload, clientEventId: id }
    };
    this.entries.push(entry);
    return this.persist() ? entry : null;
  }

  list(): QueuedAttendanceEvent[] {
    this.load();
    return [...this.entries];
  }

  remove(id: string): void {
    this.load();
    const next = this.entries.filter((entry) => entry.id !== id);
    if (next.length === this.entries.length) return;
    this.entries = next;
    this.persist();
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (!fs.existsSync(this.filePath)) {
        this.entries = [];
        return;
      }
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as QueuedAttendanceEvent[];
      this.entries = Array.isArray(parsed)
        ? parsed.filter((entry) => entry?.id && entry?.payload?.event && entry?.payload?.observedAt)
        : [];
    } catch {
      this.entries = [];
    }
  }

  private persist(): boolean {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmpPath = this.filePath + ".tmp";
      fs.writeFileSync(tmpPath, JSON.stringify(this.entries, null, 2));
      fs.renameSync(tmpPath, this.filePath);
      return true;
    } catch {
      return false;
    }
  }
}
