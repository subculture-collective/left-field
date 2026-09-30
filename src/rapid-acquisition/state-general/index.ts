import type { StateGeneralAdapter } from "../state-legislative-general-results";
import { CALIFORNIA_GENERAL } from "./california";
import { GEORGIA_GENERAL } from "./georgia";
import { ILLINOIS_GENERAL } from "./illinois";
import { NEW_YORK_GENERAL } from "./new-york";
import { VIRGINIA_GENERAL } from "./virginia";
import { WISCONSIN_GENERAL } from "./wisconsin";

/**
 * One adapter per covered state. Each reads that state's retained official
 * general-election returns and reports raw contests; normalization, margins
 * and closure checks live in state-legislative-general-results.ts.
 */
export const STATE_GENERAL_ADAPTERS: readonly StateGeneralAdapter[] = [CALIFORNIA_GENERAL, GEORGIA_GENERAL, ILLINOIS_GENERAL, NEW_YORK_GENERAL, VIRGINIA_GENERAL, WISCONSIN_GENERAL];
