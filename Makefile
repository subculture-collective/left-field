SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

override DEV_PROJECT := dsa-seats
override DEV_DATABASE_URL := postgresql://dsa_seats:dsa_seats@127.0.0.1:5432/dsa_seats
override DEV_FIXTURE_DATABASE_URL := postgresql://dsa_seats:dsa_seats@127.0.0.1:5432/dsa_seats_dev_test
override TEST_DATABASE_URL_LOCAL := postgresql://dsa_seats:dsa_seats@127.0.0.1:5432/dsa_seats_test
override E2E_DATABASE_URL_LOCAL := postgresql://dsa_seats:dsa_seats@127.0.0.1:5432/dsa_seats_e2e_test
override DEV_MAP_ROOT := /tmp/dsa-seats-dev/task10
override E2E_MAP_ROOT := /tmp/dsa-seats-task13-make/task10-maps
override E2E_PROFILE_PATH := /seats/seat_0

COMPOSE := env -u COMPOSE_FILE COMPOSE_PROJECT_NAME=$(DEV_PROJECT) docker compose -f docker-compose.yml
CLEAN_ENV := env -u NODE_ENV -u DATABASE_URL -u TEST_DATABASE_URL -u WEB_DATABASE_URL -u INGEST_DATABASE_URL -u RELEASE_PREFLIGHT_DATABASE_URL -u RELEASE_OPERATOR_DATABASE_URL

.PHONY: help local-contract install browser-install dev dev-db dev-seed db-up db-down db-logs db-migrate db-generate db-studio \
	test-db e2e-db test test-unit test-integration test-all production-contract e2e typecheck lint verify audit build check \
	acceptance clean reset-db

help: ## Show available targets.
	@printf '%s\n' \
	  'Local development (loopback PostgreSQL; not a production role-boundary test):' \
	  '  make install           Install the locked npm dependency tree' \
	  '  make browser-install   Install Chromium required by make e2e' \
	  '  make dev               Seed a disposable synthetic release and run Next dev' \
	  '  make dev-seed          Rebuild only the synthetic dsa_seats_dev_test fixture' \
	  '  make db-up             Start the local PostgreSQL service' \
	  '  make db-down           Stop containers without deleting data' \
	  '  make db-logs           Follow PostgreSQL logs' \
	  '  make db-migrate        Apply migrations to the local dev database' \
	  '  make db-generate       Check/generate Drizzle migration metadata' \
	  '  make db-studio         Open Drizzle Studio against local dev data' \
	  '' \
	  'Tests and checks:' \
	  '  make test              Run non-DB Vitest once (never watch mode)' \
	  '  make test-integration  Create/migrate the local _test DB and run guarded DB tests' \
	  '  make test-all          Run non-DB and guarded DB tests' \
	  '  make production-contract  Verify the offline production environment safety contract' \
	  '  make e2e               Run the mandatory seeded desktop/390px browser gate' \
	  '  make check             Typecheck, lint, non-DB tests, production contract, and source lock' \
	  '  make build             Build the production Next bundle' \
	  '  make audit             Fail on any npm vulnerability severity' \
	  '' \
	  'Explicitly guarded:' \
	  '  make acceptance        Run pre-provisioned 3-DB acceptance (see target error/help)' \
	  '  make reset-db CONFIRM=dsa-seats-dev-reset  Delete only the fixed local dev volume'

local-contract:
	@if [[ -n "$${DOCKER_HOST:-}" ]]; then \
	  printf '%s\n' 'Refusing a non-default DOCKER_HOST; local targets must use the local Docker daemon.' >&2; exit 2; \
	fi

install: ## Install dependencies exactly from package-lock.json.
	npm ci

browser-install: ## Install the Playwright Chromium runtime.
	npx playwright install chromium

db-up: local-contract ## Start local PostGIS and wait for health.
	$(COMPOSE) up -d --wait postgres

db-down: local-contract ## Stop local containers without deleting volumes.
	$(COMPOSE) down

db-logs: local-contract ## Follow local PostgreSQL logs.
	$(COMPOSE) logs -f postgres

db-migrate: db-up ## Apply migrations to the fixed local development database.
	env DATABASE_URL='$(DEV_DATABASE_URL)' npm run db:migrate

db-generate: ## Generate/check Drizzle metadata without connecting to a database.
	$(CLEAN_ENV) npm run db:generate

db-studio: db-up ## Open Drizzle Studio against the fixed local database.
	env DATABASE_URL='$(DEV_DATABASE_URL)' npm run db:studio

dev-db: db-up ## Idempotently create and migrate the disposable synthetic dev database.
	@if ! $(COMPOSE) exec -T postgres psql -U dsa_seats -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname='dsa_seats_dev_test'" | grep -qx 1; then \
	  $(COMPOSE) exec -T postgres createdb -U dsa_seats -O dsa_seats dsa_seats_dev_test; \
	fi
	env DATABASE_URL='$(DEV_FIXTURE_DATABASE_URL)' npm run db:migrate

dev-seed: dev-db ## Rebuild the disposable synthetic release used by make dev.
	env NODE_ENV=test DATABASE_URL='$(DEV_FIXTURE_DATABASE_URL)' MAP_ARTIFACT_ROOT='$(DEV_MAP_ROOT)' npm run seed:task10-map-e2e

dev: dev-seed ## Run Next against the disposable synthetic development release.
	env NODE_ENV=development DATABASE_URL='$(DEV_FIXTURE_DATABASE_URL)' WEB_DATABASE_URL='$(DEV_FIXTURE_DATABASE_URL)' INGEST_DATABASE_URL='$(DEV_FIXTURE_DATABASE_URL)' MAP_ARTIFACT_ROOT='$(DEV_MAP_ROOT)' CORRECTION_INTAKE_ENABLED=false ADDRESS_LOOKUP_MODE=disabled npm run dev

test-db: db-up ## Idempotently create and migrate the guarded integration database.
	@if ! $(COMPOSE) exec -T postgres psql -U dsa_seats -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname='dsa_seats_test'" | grep -qx 1; then \
	  $(COMPOSE) exec -T postgres createdb -U dsa_seats -O dsa_seats dsa_seats_test; \
	fi
	env DATABASE_URL='$(TEST_DATABASE_URL_LOCAL)' npm run db:migrate

e2e-db: db-up ## Idempotently create the disposable browser-test database.
	@if ! $(COMPOSE) exec -T postgres psql -U dsa_seats -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname='dsa_seats_e2e_test'" | grep -qx 1; then \
	  $(COMPOSE) exec -T postgres createdb -U dsa_seats -O dsa_seats dsa_seats_e2e_test; \
	fi

test test-unit: ## Run non-integration Vitest once.
	$(CLEAN_ENV) npm run test:run -- --exclude src/db/integration.test.ts

test-integration: test-db ## Run guarded PostgreSQL integration tests.
	env TEST_DATABASE_URL='$(TEST_DATABASE_URL_LOCAL)' npm run test:integration

test-all: test test-integration ## Run non-DB and guarded DB suites.

production-contract: ## Verify the offline production environment safety contract.
	$(CLEAN_ENV) npm run test:production-contract

e2e: e2e-db ## Run seeded Chromium desktop/390px and Axe gates.
	env DATABASE_URL='$(E2E_DATABASE_URL_LOCAL)' WEB_DATABASE_URL='$(E2E_DATABASE_URL_LOCAL)' MAP_ARTIFACT_ROOT='$(E2E_MAP_ROOT)' E2E_MAP_PROFILE_PATH='$(E2E_PROFILE_PATH)' npm run test:e2e:task13

typecheck:
	$(CLEAN_ENV) npm run typecheck

lint:
	$(CLEAN_ENV) npm run lint

verify:
	$(CLEAN_ENV) npm run data:verify

audit: ## Fail if npm reports any vulnerability severity.
	npm audit --audit-level=low

build:
	$(CLEAN_ENV) npm run build

check: typecheck lint test production-contract verify ## Run the fast, non-DB merge checks.

acceptance: ## Run only after provisioning the three DB lanes and restricted web login.
	@if [[ "$${ACCEPTANCE_TESTS:-}" != '1' ]]; then \
	  printf '%s\n' \
	    'Acceptance is not provisioned by make dev.' \
	    'Use the acceptance CI workflow or provision its integration/query/browser _test DBs,' \
	    'restricted WEB_DATABASE_URL, map root, and ACCEPTANCE_TESTS=1 first.' >&2; exit 2; \
	fi
	npm run test:acceptance

clean: ## Remove generated application/test artifacts; keep database data.
	rm -rf .next coverage test-results

reset-db: local-contract ## Delete and recreate only the fixed local development Compose volume.
	@if [[ "$${CONFIRM:-}" != 'dsa-seats-dev-reset' ]]; then \
	  printf '%s\n' 'Refusing destructive reset. Re-run with CONFIRM=dsa-seats-dev-reset.' >&2; exit 2; \
	fi
	$(COMPOSE) down -v --remove-orphans
	$(MAKE) db-migrate
