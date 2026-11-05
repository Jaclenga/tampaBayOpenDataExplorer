# Convenience entry point. No R package reimplementation: Node reads the package's
# authoritative JSON registry and expected schemas, validates, then replaces output.
# Clone Jaclenga/tampaBayOpenData to .upstream, or set TBOD_SOURCE first.
status <- system2("node", "scripts/generate-catalog.mjs")
if (!identical(status, 0L)) stop("Catalog generation failed; previous catalog retained.")
