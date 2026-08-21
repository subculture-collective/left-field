# Nationwide office-universe intake runtime

The `office_universe` schema is an additive, non-public operational context for state and local intake. It has no foreign keys to the federal release, `public.offices`, or `public.seat_cycles` tables. It must not be included in a federal release manifest or exposed through the existing public routes.

## First database setup

1. Apply the normal repository migration workflow through `0017_nationwide_office_universe_intake` to the intended local/staging database.
2. Run `OFFICE_UNIVERSE_DATABASE_URL=<explicit local-or-staging URL> npm run seed:nationwide-office-universe-registry`.
3. Confirm that 250 source-registry rows exist: five source-family slots for each of the 50 states.

The seed intentionally configures only the two shared national discovery sources. State elections, finance, and officeholder slots begin as `authority_unavailable`, with no guessed endpoint. This is an explicit acquisition backlog, not a claim that the state lacks an election authority.

## Intake states

- `accepted` raw payloads are retained even when their office universe, finance, geography, filing, or certification facts are incomplete.
- `quarantined` payloads retain the immutable raw receipt plus sanitized issue records. A bad record does not reject its batch.
- `reported_result` and `provisional_winner` can feed only the provisional workspace.
- `certified_winner` can feed a compatible certified formula program after its required factual inputs are complete.
- A provisional primary or November winner creates `holder_pending_transition`; it never overwrites `current_holder` before the term's sourced effective date.

## Refresh behavior

Configured election sources are eligible for 15-minute polling during the election-night window. Normal discovery runs weekly; finance and officeholder slots run nightly/daily when configured. Unconfigured authority slots are revisited daily as backlog, but are not polled as though an endpoint existed.

## Current boundary

This implementation supplies the nationwide platform, 50-state registry, persistence model, raw/quarantine semantics, holder lifecycle, and calculation isolation. It does **not** acquire, publish, certify, or claim complete state/local election coverage. State-specific official endpoints and any aggregator contracts must be retained and reviewed before those slots become `configured`.
