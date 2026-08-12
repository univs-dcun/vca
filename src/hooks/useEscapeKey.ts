"use client";

import { useEffect } from "react";

// Shared Escape-to-close behavior for any modal/dropdown/popover in the app — call with the
// same onClose passed to the component's close button / click-outside handler so all three
// dismiss paths stay in sync. Pass enabled=false to skip attaching the listener (e.g. while a
// nested picker inside the modal should swallow Escape for itself instead).
export function useEscapeKey(onClose: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, enabled]);
}
