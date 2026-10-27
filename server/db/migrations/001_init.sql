-- Bay Leaf loyalty platform — initial schema.
-- Principles:
--   * card_definitions / reward_definitions hold the RULES (editable by admins).
--   * customer_cards / customer_rewards hold each customer's PROGRESS, snapshotted
--     from the rules at activation so later edits never rewrite history.
--   * Nothing expires on a timer. There is no column, job or trigger that resets progress.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- outlets & staff ----------
CREATE TABLE outlets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  code        text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{2,20}$'),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE staff_role AS ENUM ('super_admin', 'admin', 'staff');

CREATE TABLE staff_users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             text NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 120),
  username              text NOT NULL CHECK (username ~ '^[a-z0-9._-]{3,40}$'),
  password_hash         text NOT NULL,
  role                  staff_role NOT NULL,
  outlet_id             uuid REFERENCES outlets(id),
  is_active             boolean NOT NULL DEFAULT true,
  failed_logins         integer NOT NULL DEFAULT 0,
  locked_until          timestamptz,
  must_change_password  boolean NOT NULL DEFAULT false,
  last_login_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX staff_users_username_key ON staff_users (lower(username));

CREATE TABLE staff_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    bytea NOT NULL UNIQUE,
  staff_id      uuid NOT NULL REFERENCES staff_users(id),
  outlet_id     uuid REFERENCES outlets(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  ip            text,
  user_agent    text
);
CREATE INDEX staff_sessions_staff_idx ON staff_sessions (staff_id);

-- ---------- customers ----------
CREATE TABLE customers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_code             text NOT NULL UNIQUE CHECK (member_code ~ '^BL[0-9A-Z]{6}$'),
  full_name               text NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 120),
  phone_e164              text NOT NULL UNIQUE CHECK (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  status                  text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  preferred_language      text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ar')),
  registered_via          text NOT NULL CHECK (registered_via IN ('staff', 'self')),
  registered_by_staff_id  uuid REFERENCES staff_users(id),
  registered_outlet_id    uuid REFERENCES outlets(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_name_trgm ON customers USING gin (lower(full_name) gin_trgm_ops);
CREATE INDEX customers_created_idx ON customers (created_at);

-- QR tokens (scanned by staff) and card-link tokens (opened by the customer).
-- Lookup uses an HMAC of the token; the token itself is stored AES-GCM encrypted
-- because the customer's screen and the staff WhatsApp share must show it again.
CREATE TABLE customer_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES customers(id),
  kind            text NOT NULL CHECK (kind IN ('qr', 'link')),
  token_hash      bytea NOT NULL UNIQUE,
  token_enc       text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  revoked_reason  text
);
CREATE UNIQUE INDEX customer_tokens_one_active ON customer_tokens (customer_id, kind) WHERE revoked_at IS NULL;

CREATE TABLE customer_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    bytea NOT NULL UNIQUE,
  customer_id   uuid NOT NULL REFERENCES customers(id),
  scope         text NOT NULL CHECK (scope IN ('link', 'verified')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz
);
CREATE INDEX customer_sessions_customer_idx ON customer_sessions (customer_id);

CREATE TABLE otp_challenges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164    text NOT NULL,
  purpose       text NOT NULL CHECK (purpose IN ('join', 'sign_in')),
  code_hash     bytea NOT NULL,
  pending_name  text,
  attempts      integer NOT NULL DEFAULT 0,
  max_attempts  integer NOT NULL DEFAULT 5,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  ip            text
);
CREATE INDEX otp_challenges_phone_idx ON otp_challenges (phone_e164, created_at DESC);

-- ---------- loyalty rules ----------
CREATE TABLE card_definitions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence         integer NOT NULL UNIQUE CHECK (sequence >= 1),
  name             text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  level_label      text NOT NULL CHECK (length(trim(level_label)) BETWEEN 1 AND 40),
  required_visits  integer NOT NULL CHECK (required_visits BETWEEN 1 AND 60),
  description      text NOT NULL DEFAULT '',
  terms            text NOT NULL DEFAULT '',
  theme            text NOT NULL DEFAULT 'forest' CHECK (theme IN ('forest', 'midnight', 'ivory', 'saffron')),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reward_definitions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_definition_id  uuid NOT NULL REFERENCES card_definitions(id),
  milestone_visit     integer NOT NULL CHECK (milestone_visit >= 1),
  name                text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  description         text NOT NULL DEFAULT '',
  terms               text NOT NULL DEFAULT '',
  -- true until Bay Leaf names the reward (Card 1 visits 4 and 8 start this way).
  is_placeholder      boolean NOT NULL DEFAULT false,
  is_available        boolean NOT NULL DEFAULT true,
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reward_definitions_one_per_milestone
  ON reward_definitions (card_definition_id, milestone_visit) WHERE archived_at IS NULL;

-- ---------- customer progress ----------
CREATE TABLE customer_cards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid NOT NULL REFERENCES customers(id),
  card_definition_id  uuid NOT NULL REFERENCES card_definitions(id),
  sequence            integer NOT NULL,
  card_name           text NOT NULL,
  level_label         text NOT NULL,
  theme               text NOT NULL,
  required_visits     integer NOT NULL CHECK (required_visits >= 1),
  visit_count         integer NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  activated_at        timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  CHECK (visit_count BETWEEN 0 AND required_visits),
  CHECK ((status = 'completed') = (visit_count = required_visits AND completed_at IS NOT NULL)),
  UNIQUE (customer_id, sequence)
);
CREATE UNIQUE INDEX customer_cards_one_active ON customer_cards (customer_id) WHERE status = 'active';
CREATE INDEX customer_cards_status_idx ON customer_cards (status);

CREATE TABLE customer_rewards (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid NOT NULL REFERENCES customers(id),
  customer_card_id      uuid NOT NULL REFERENCES customer_cards(id),
  reward_definition_id  uuid NOT NULL REFERENCES reward_definitions(id),
  milestone_visit       integer NOT NULL,
  status                text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'eligible', 'redeemed', 'revoked')),
  eligible_at           timestamptz,
  revoked_at            timestamptz,
  revoked_by            uuid REFERENCES staff_users(id),
  revoke_reason         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_card_id, milestone_visit)
);
CREATE INDEX customer_rewards_customer_idx ON customer_rewards (customer_id, status);

CREATE TABLE reward_redemptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference           text NOT NULL UNIQUE,
  -- UNIQUE: the database itself refuses a second redemption of the same reward.
  customer_reward_id  uuid NOT NULL UNIQUE REFERENCES customer_rewards(id),
  customer_id         uuid NOT NULL REFERENCES customers(id),
  customer_card_id    uuid NOT NULL REFERENCES customer_cards(id),
  reward_name         text NOT NULL,
  staff_id            uuid NOT NULL REFERENCES staff_users(id),
  outlet_id           uuid REFERENCES outlets(id),
  idempotency_key     text UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reward_redemptions_created_idx ON reward_redemptions (created_at);

CREATE TABLE visits (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference          text NOT NULL UNIQUE,
  customer_id        uuid NOT NULL REFERENCES customers(id),
  customer_card_id   uuid NOT NULL REFERENCES customer_cards(id),
  visit_number       integer NOT NULL CHECK (visit_number >= 1),
  business_date      date NOT NULL,
  source             text NOT NULL CHECK (source IN ('counter', 'correction')),
  bill_amount        numeric(12, 2),
  staff_id           uuid NOT NULL REFERENCES staff_users(id),
  outlet_id          uuid REFERENCES outlets(id),
  idempotency_key    text UNIQUE,
  correction_reason  text,
  status             text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'voided')),
  voided_at          timestamptz,
  voided_by          uuid REFERENCES staff_users(id),
  void_reason        text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX visits_unique_number ON visits (customer_card_id, visit_number) WHERE status = 'valid';
CREATE INDEX visits_customer_day_idx ON visits (customer_id, business_date) WHERE status = 'valid';
CREATE INDEX visits_created_idx ON visits (created_at);
CREATE INDEX visits_staff_idx ON visits (staff_id, created_at DESC);

-- ---------- settings & audit ----------
CREATE TABLE app_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES staff_users(id)
);

CREATE TABLE audit_events (
  id           bigserial PRIMARY KEY,
  actor_type   text NOT NULL CHECK (actor_type IN ('staff', 'customer', 'system')),
  actor_id     uuid,
  actor_name   text,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text,
  customer_id  uuid,
  outlet_id    uuid,
  reason       text,
  details      jsonb NOT NULL DEFAULT '{}',
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_created_idx ON audit_events (created_at DESC);
CREATE INDEX audit_events_customer_idx ON audit_events (customer_id, created_at DESC);
CREATE INDEX audit_events_action_idx ON audit_events (action, created_at DESC);

-- Audit history is append-only at the database level, not just in the UI.
CREATE FUNCTION audit_events_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END $$;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_immutable();
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_immutable();
