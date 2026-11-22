"use client";

import { useEffect } from "react";

export function useUnsavedSettings(dirty: boolean, saving: boolean) {
  useEffect(() => {
    if (!dirty) return;

    function unload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function followLink(event: MouseEvent) {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" ||
          link.origin !== location.origin || link.href === location.href) return;
      if (window.confirm(saving ? "A save is in progress. Leave this page?" : "Discard your unsaved changes?")) return;
      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", followLink, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", followLink, true);
    };
  }, [dirty, saving]);
}
