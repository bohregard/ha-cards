/** Move Home Assistant's frontend to another dashboard path, the way its own links do. */
export function navigate(path: string) {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}
