import { ErrorState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="bg-dotgrid grid min-h-dvh place-items-center p-4">
      <ErrorState code="not_found" title="That page doesn't exist" message="The link may be old or mistyped." backHref="/" backLabel="Go to the start" />
    </div>
  );
}
