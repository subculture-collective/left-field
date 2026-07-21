import { AddressAdmissionRepository } from "./admission";
import { CensusGeocoderAdapter } from "./census-geocoder";
import { PostgresAddressResolver, PostgresSeatLocator } from "./postgres-resolver";
import { getAddressPool } from "@/db/client";
import type { AddressConfig } from "./config";
export function createAddressRuntime(config: AddressConfig) { const pool = getAddressPool(); return { repository: new AddressAdmissionRepository(pool), resolver: new PostgresAddressResolver({ releaseId: config.releaseId!, productVintage: "2025" }, new CensusGeocoderAdapter({ timeoutMs: 5_000 }), new PostgresSeatLocator(pool)) }; }
