/** Fired by the demo tools after they change mock data, so open screens refetch. */
export const DEMO_CHANGED_EVENT = "ll-demo-changed";

export function announceDemoChange(): void {
  window.dispatchEvent(new Event(DEMO_CHANGED_EVENT));
}
