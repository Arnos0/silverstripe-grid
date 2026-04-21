// Entry point for the preview inspector bundle. Activates only when running
// inside an iframe (i.e. the CMS preview context). When loaded on a public
// page by mistake, the guard makes it a no-op.
if (typeof window !== "undefined" && window !== window.top) {
  // Remaining modules are wired in later tasks.
}
