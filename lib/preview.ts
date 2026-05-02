"use client";

import { useEffect, useState } from "react";

function isProductionBuild() {
  return process.env.NODE_ENV === "production";
}

export function usePreviewMode() {
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (isProductionBuild()) {
      setPreviewMode(false);
      return;
    }

    const envEnabled = process.env.NEXT_PUBLIC_DEV_MODE === "true";
    const queryEnabled = new URLSearchParams(window.location.search).get("preview") === "true";

    setPreviewMode(queryEnabled || envEnabled);
  }, []);

  return previewMode;
}

export function withPreview(path: string, previewMode: boolean) {
  if (!previewMode || isProductionBuild()) return path;
  return path.includes("?") ? `${path}&preview=true` : `${path}?preview=true`;
}
