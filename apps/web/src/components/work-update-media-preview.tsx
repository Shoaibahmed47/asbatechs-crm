"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Loader2, X } from "lucide-react";

type ResolvedMedia = {
  src: string;
  mimeType: string;
  fileName: string;
};

export function WorkUpdateMediaPreview({ item }: { item: ResolvedMedia }) {
  const [isHidden] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(item.mimeType.startsWith("video/"));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openPreview = () => {
    if (item.mimeType.startsWith("video/")) {
      setIsVideoLoading(true);
    }
    setIsPreviewOpen(true);
  };

  const closePreview = () => setIsPreviewOpen(false);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsPreviewOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isPreviewOpen]);

  const previewButton = (
    <button
      type="button"
      onClick={openPreview}
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/30"
      aria-label={`Open preview for ${item.fileName}`}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-black/70 px-3 py-1.5 text-sm font-medium text-white">
        <Eye className="h-3.5 w-3.5" />
        Preview
      </span>
    </button>
  );

  const previewModal =
    mounted && isPreviewOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
            role="presentation"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"
              aria-label="Close preview"
              onClick={closePreview}
            />
            <button
              type="button"
              onClick={closePreview}
              className="fixed right-3 top-3 z-[202] inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-lg ring-1 ring-black/40 transition hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 sm:right-5 sm:top-5"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Preview: ${item.fileName}`}
              className="relative z-[201] flex max-h-[min(92vh,920px)] w-full max-w-[min(100%,1200px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0f172a] px-4 py-3">
                <p className="min-w-0 truncate text-sm font-medium text-slate-200" title={item.fileName}>
                  {item.fileName}
                </p>
                <button
                  type="button"
                  onClick={closePreview}
                  className="hidden shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white sm:inline-flex"
                  aria-label="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-[#050914] p-3 sm:p-5">
                {item.mimeType.startsWith("image/") ? (
                  <div className="flex min-h-[200px] items-center justify-center">
                    <img
                      src={item.src}
                      alt={item.fileName}
                      className="max-h-[min(78vh,820px)] w-full max-w-full object-contain"
                    />
                  </div>
                ) : item.mimeType.startsWith("video/") ? (
                  <div className="relative mx-auto max-w-full">
                    <video
                      controls
                      autoPlay
                      playsInline
                      preload="auto"
                      src={item.src}
                      className="mx-auto max-h-[min(78vh,820px)] w-full rounded-lg bg-black object-contain"
                      onWaiting={() => setIsVideoLoading(true)}
                      onCanPlay={() => setIsVideoLoading(false)}
                      onPlaying={() => setIsVideoLoading(false)}
                      onLoadedData={() => setIsVideoLoading(false)}
                    />
                    {isVideoLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-black/65 px-3 py-1.5 text-sm font-medium text-white">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Video is loading...
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : item.mimeType === "application/pdf" ? (
                  <iframe title={item.fileName} src={item.src} className="h-[min(78vh,820px)] w-full rounded-lg bg-white" />
                ) : (
                  <a
                    href={item.src}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-sky-300 hover:underline"
                  >
                    Open file
                  </a>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (item.mimeType.startsWith("image/")) {
    return (
      <>
        <div className="w-[220px] overflow-hidden rounded-xl border border-slate-700 bg-[#111827]">
          <div className="truncate border-b border-slate-700/80 px-2 py-1.5 text-base text-slate-300">
            {item.fileName}
          </div>
          <div className="relative p-2">
            <img
              src={item.src}
              alt={item.fileName}
              className={`mx-auto h-[150px] w-full rounded-md object-cover transition duration-200 ${isHidden ? "scale-[1.01] blur-md brightness-75" : ""}`}
            />
            {previewButton}
          </div>
        </div>
        {previewModal}
      </>
    );
  }

  if (item.mimeType.startsWith("video/")) {
    return (
      <>
        <div className="w-[220px] overflow-hidden rounded-xl border border-slate-700 bg-[#111827]">
          <div className="truncate border-b border-slate-700/80 px-2 py-1.5 text-base text-slate-300">
            {item.fileName}
          </div>
          <div className="relative p-2">
            <video
              playsInline
              preload="auto"
              muted
              src={item.src}
              className={`mx-auto h-[150px] w-full rounded-md bg-black object-cover transition duration-200 ${isHidden ? "scale-[1.01] blur-md brightness-75" : ""}`}
            />
            {previewButton}
          </div>
        </div>
        {previewModal}
      </>
    );
  }

  if (item.mimeType === "application/pdf") {
    return (
      <>
        <div className="w-[220px] overflow-hidden rounded-xl border border-slate-700 bg-[#111827]">
          <div className="truncate border-b border-slate-700/80 px-2 py-1.5 text-base text-slate-300">
            {item.fileName}
          </div>
          <button
            type="button"
            onClick={openPreview}
            className="relative flex h-[166px] w-full items-center justify-center bg-black/30"
            aria-label={`Open preview for ${item.fileName}`}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-black/70 px-3 py-1.5 text-sm font-medium text-white">
              <Eye className="h-3.5 w-3.5" />
              Preview
            </span>
          </button>
        </div>
        {previewModal}
      </>
    );
  }

  return (
    <>
      <div className="w-[220px] rounded-xl border border-slate-700 bg-[#111827] p-3">
        <p className="truncate text-sm text-slate-200">{item.fileName}</p>
        <button
          type="button"
          onClick={openPreview}
          className="mt-2 inline-block text-sm font-medium text-sky-300 hover:underline"
        >
          Preview
        </button>
      </div>
      {previewModal}
    </>
  );
}
