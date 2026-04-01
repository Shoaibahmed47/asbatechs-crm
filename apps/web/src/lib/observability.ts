import * as Sentry from "@sentry/node";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

type LogLevel = "debug" | "info" | "warn" | "error";

export type RequestContext = {
  requestId: string;
  route: string;
  method: string;
  timestamp: string;
};

let sentryInitialized = false;

function initSentry() {
  if (sentryInitialized) return;
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE
  });
  sentryInitialized = true;
}

function emit(level: LogLevel, event: string, data: Record<string, unknown>) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...data
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function getRequestContext(req: NextRequest): RequestContext {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  return {
    requestId,
    route: req.nextUrl.pathname,
    method: req.method,
    timestamp: new Date().toISOString()
  };
}

export function errorJson(
  ctx: RequestContext,
  status: number,
  error: string,
  details?: unknown
) {
  const body: Record<string, unknown> = {
    error,
    requestId: ctx.requestId,
    route: ctx.route,
    timestamp: new Date().toISOString()
  };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, {
    status,
    headers: { "x-request-id": ctx.requestId }
  });
}

export function okJson(
  ctx: RequestContext,
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: { "x-request-id": ctx.requestId }
  });
}

export async function withObservedRequest(
  req: NextRequest,
  handler: (ctx: RequestContext) => Promise<NextResponse>
) {
  const ctx = getRequestContext(req);
  const startedAt = Date.now();
  initSentry();
  emit("info", "http.request.start", {
    requestId: ctx.requestId,
    route: ctx.route,
    method: ctx.method
  });

  try {
    const res = await handler(ctx);
    emit("info", "http.request.finish", {
      requestId: ctx.requestId,
      route: ctx.route,
      method: ctx.method,
      status: res.status,
      durationMs: Date.now() - startedAt
    });
    if (!res.headers.get("x-request-id")) {
      res.headers.set("x-request-id", ctx.requestId);
    }
    return res;
  } catch (err) {
    const error = err instanceof Error ? err : new Error("Unknown server error");
    emit("error", "http.request.error", {
      requestId: ctx.requestId,
      route: ctx.route,
      method: ctx.method,
      durationMs: Date.now() - startedAt,
      message: error.message,
      stack: error.stack
    });

    if (sentryInitialized) {
      Sentry.captureException(error, {
        tags: { route: ctx.route, method: ctx.method },
        extra: { requestId: ctx.requestId }
      });
    }

    return errorJson(ctx, 500, "Internal server error");
  }
}
