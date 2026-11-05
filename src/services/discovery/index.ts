import { discoverArcGIS } from "./arcgis";
import { discoverExternal } from "./external";
import type { Portal, DiscoveryOptions } from "./types";
export function discoverPortal(portal: Portal, options: DiscoveryOptions) {
  return portal.platform === "arcgis"
    ? discoverArcGIS(portal, options)
    : discoverExternal(portal, options);
}
