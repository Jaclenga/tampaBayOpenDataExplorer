import type { LayerMetadata } from "../types";

export default function LiveFreshness({
  metadata,
}: {
  metadata: LayerMetadata | null;
}) {
  if (!metadata) return null;
  return (
    <p className="muted">
      Source last edit:{" "}
      {metadata.sourceUpdatedAt
        ? new Date(metadata.sourceUpdatedAt).toLocaleString()
        : "Not reported"}
      . Metadata checked:{" "}
      {metadata.inspectedAt
        ? new Date(metadata.inspectedAt).toLocaleString()
        : "Not recorded"}
      .
    </p>
  );
}
