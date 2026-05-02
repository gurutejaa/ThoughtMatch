"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

function isProductionBuild() {
  return process.env.NODE_ENV === "production";
}

export function usePreviewMode() {
  const searchParams = useSearchParams();

  return useMemo(() => {
    if (isProductionBuild()) return false;

    const envEnabled = process.env.NEXT_PUBLIC_DEV_MODE === "true";
    const queryEnabled = searchParams.get("preview") === "true";

    return queryEnabled || envEnabled;
  }, [searchParams]);
}

export function withPreview(path: string, previewMode: boolean) {
  if (!previewMode || isProductionBuild()) return path;
  return path.includes("?") ? `${path}&preview=true` : `${path}?preview=true`;
}
