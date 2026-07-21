import { parseAddressConfig } from "@/address/config";
import { Notice, Shell } from "@/components/presentational";
import dynamicComponent from "next/dynamic";

// Keep the address-taking client code out of disabled and canary responses.
const AddressForm = dynamicComponent(() => import("./address-form").then(module => module.AddressForm));

export const dynamic = "force-dynamic";
export const revalidate = 0;

function DisabledLookup({ unavailable = false }: { unavailable?: boolean }) {
  return <Shell><main className="page prose lookup-page"><p className="eyebrow">ADDRESS LOOKUP / DEPLOYMENT STATUS</p><h1>{unavailable ? "Address lookup is unavailable" : "Address lookup is not enabled here"}</h1><Notice title={unavailable ? "Configuration is not available" : "Shared deployment is gated"}><p>{unavailable ? "This deployment cannot verify an approved address-lookup configuration. No address can be entered or submitted from this page." : "This private prototype does not accept or submit addresses in a shared deployment. Address lookup remains disabled pending privacy audits."}</p></Notice><section className="record-section"><h2>Privacy boundary</h2><p>This page contains no address form, analytics, session replay, or third-party address code. No public enablement is approved in the checked-in defaults.</p></section><section className="record-section"><h2>Possible result states</h2><dl><dt>Matched</dt><dd>An approved future flow may identify a House seat and the applicable Senate representation without retaining the address.</dd><dt>Not matched</dt><dd>The external processor may not resolve the submitted address.</dd><dt>Unavailable</dt><dd>The processor or approved service may be unavailable.</dd></dl></section></main></Shell>;
}

function lookupMode() {
  try { return parseAddressConfig(process.env).mode; } catch { return "unavailable" as const; }
}

export default function Lookup() {
  const mode = lookupMode();
  if (mode === "unavailable") return <DisabledLookup unavailable />;
  if (mode !== "enabled") return <DisabledLookup />;
  return <Shell><main className="page prose lookup-page"><p className="eyebrow">ADDRESS LOOKUP / APPROVED ENVIRONMENT</p><h1>Find the federal seats for an address</h1><p className="lede">This tool returns the applicable House seat and Senate representation for the active release. It does not store your address in the browser.</p><AddressForm /></main></Shell>;
}
