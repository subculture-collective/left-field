import type { StateGeneralAdapter } from "../state-legislative-general-results";
import { CALIFORNIA_GENERAL } from "./california";
import { COLORADO_GENERAL } from "./colorado";
import { CONNECTICUT_GENERAL } from "./connecticut";
import { GEORGIA_GENERAL } from "./georgia";
import { ILLINOIS_GENERAL } from "./illinois";
import { MARYLAND_GENERAL } from "./maryland";
import { NEW_YORK_GENERAL } from "./new-york";
import { NORTH_CAROLINA_GENERAL } from "./north-carolina";
import { PENNSYLVANIA_GENERAL } from "./pennsylvania";
import { VIRGINIA_GENERAL } from "./virginia";
import { WASHINGTON_GENERAL } from "./washington";
import { WISCONSIN_GENERAL } from "./wisconsin";

/**
 * One adapter per covered state. Each reads that state's retained official
 * general-election returns and reports raw contests; normalization, margins
 * and closure checks live in state-legislative-general-results.ts.
 */
export const STATE_GENERAL_ADAPTERS: readonly StateGeneralAdapter[] = [CALIFORNIA_GENERAL, COLORADO_GENERAL, CONNECTICUT_GENERAL, GEORGIA_GENERAL, ILLINOIS_GENERAL, MARYLAND_GENERAL, NEW_YORK_GENERAL, NORTH_CAROLINA_GENERAL, PENNSYLVANIA_GENERAL, VIRGINIA_GENERAL, WASHINGTON_GENERAL, WISCONSIN_GENERAL];
