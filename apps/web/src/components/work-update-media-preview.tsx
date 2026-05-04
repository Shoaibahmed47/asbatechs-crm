"use client";

import { useState } from "react";
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

  const openPreview = () => {
    if (item.mimeType.startsWith("video/")) {
      setIsVideoLoading(true);
    }
    setIsPreviewOpen(true);
  };

  const previewButton = (
    <button
      type="button"
      onClick={openPreview}
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/30"
      aria-label={`Open preview for ${item.fileName}`}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
        <Eye className="h-3.5 w-3.5" />
        Preview
      </span>
    </button>
  );

  const previewModal = isPreviewOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-xl border border-slate-700 bg-[#0f172a]">
        <div className="flex items-center justify-between border-b border-slate-700/80 px-3 py-2">
          <p className="truncate text-xs text-slate-300">{item.fileName}</p>
          <button
            type="button"
            onClick={() => setIsPreviewOpen(false)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          {item.mimeType.startsWith("image/") ? (
            <img src={item.src} alt={item.fileName} className="mx-auto max-h-[80vh] w-full object-contain" />
          ) : item.mimeType.startsWith("video/") ? (
            <div className="relative">
              <video
                controls
                autoPlay
                playsInline
                preload="auto"
                src={item.src}
                className="mx-auto max-h-[80vh] w-full rounded-lg bg-black"
                onWaiting={() => setIsVideoLoading(true)}
                onCanPlay={() => setIsVideoLoading(false)}
                onPlaying={() => setIsVideoLoading(false)}
                onLoadedData={() => setIsVideoLoading(false)}
              />
              {isVideoLoading ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-black/65 px-3 py-1.5 text-xs font-medium text-white">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Video is loading...
                  </span>
                </div>
              ) : null}
            </div>
          ) : item.mimeType === "application/pdf" ? (
            <iframe title={item.fileName} src={item.src} className="h-[80vh] w-full rounded-lg bg-white" />
          ) : (
            <a href={item.src} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-300 hover:underline">
              Open file
            </a>
          )}
        </div>
      </div>
    </div>
  ) : null;

  if (item.mimeType.startsWith("image/")) {
    return (
      <>
        <div className="w-[220px] overflow-hidden rounded-xl border border-slate-700 bg-[#111827]">
          <div className="truncate border-b border-slate-700/80 px-2 py-1.5 text-[10px] text-slate-300">
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
          <div className="truncate border-b border-slate-700/80 px-2 py-1.5 text-[10px] text-slate-300">
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
          <div className="truncate border-b border-slate-700/80 px-2 py-1.5 text-[10px] text-slate-300">
            {item.fileName}
          </div>
          <button
            type="button"
            onClick={openPreview}
            className="relative flex h-[166px] w-full items-center justify-center bg-black/30"
            aria-label={`Open preview for ${item.fileName}`}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
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
        <p className="truncate text-xs text-slate-200">{item.fileName}</p>
        <button
          type="button"
          onClick={openPreview}
          className="mt-2 inline-block text-xs font-medium text-sky-300 hover:underline"
        >
          Preview
        </button>
      </div>
      {previewModal}
    </>
  );
}
