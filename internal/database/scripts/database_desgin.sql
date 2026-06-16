-- =============================================================================
-- CLINIC QUEUE MANAGER — DATABASE SCHEMA
-- Focus: Scalability, Consistency, Fast Performance
-- Primary Keys: BIGSERIAL (numeric, sequential) everywhere
-- =============================================================================

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- for crypt() and gen_salt() (PIN hashing)
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- for fuzzy/trigram search on patient names


-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE token_status AS ENUM (
  'waiting',    -- in queue, not yet called
  'serving',    -- currently being consulted
  'done',       -- consultation completed
  'skipped',    -- receptionist skipped this token
  'no_show'     -- patient didn't show up when called
);

CREATE TYPE avg_mode AS ENUM (
  'auto',       -- computed from rolling average of recent consultations
  'manual'      -- receptionist has overridden the value
);

CREATE TYPE sms_status AS ENUM (
  'not_required',  -- no phone number provided
  'pending',       -- scheduled to be sent (e.g. 2 tokens before their turn)
  'sent',          -- successfully dispatched to SMS provider
  'failed',        -- provider returned error
  'delivered'      -- provider confirmed delivery (if DLR supported)
);


-- =============================================================================
-- TABLE: clinics
-- One row per registered clinic. Registered once, never duplicated.
-- =============================================================================

CREATE TABLE clinics (
  id                        BIGSERIAL       PRIMARY KEY,
  name                      VARCHAR(255)    NOT NULL,
  slug                      VARCHAR(100)    NOT NULL,         -- URL-safe identifier e.g. "dr-patel-ward7"
  phone                     VARCHAR(15),                      -- clinic contact number
  address                   TEXT,
  pin_hash                  TEXT            NOT NULL,         -- bcrypt hash of receptionist PIN
  timezone                  VARCHAR(60)     NOT NULL DEFAULT 'Asia/Kolkata',
  default_avg_consult_secs  INT             NOT NULL DEFAULT 600,  -- seed: 10 minutes
  is_active                 BOOLEAN         NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ     NOT NULL DEFAULT now(),

  CONSTRAINT clinics_slug_unique UNIQUE (slug),
  CONSTRAINT clinics_slug_format CHECK (slug ~ '^[a-z0-9\-]+$'),
  CONSTRAINT clinics_consult_secs_positive CHECK (default_avg_consult_secs > 0)
);

-- Index for slug lookups (used on every receptionist login and patient URL resolve)
CREATE UNIQUE INDEX idx_clinics_slug ON clinics (slug);
CREATE INDEX idx_clinics_is_active ON clinics (is_active) WHERE is_active = true;

COMMENT ON TABLE clinics IS 'Master registry of all clinics. One row per clinic, registered once.';
COMMENT ON COLUMN clinics.slug IS 'Human-readable URL identifier. Used in patient screen URL: /queue/{slug}';
COMMENT ON COLUMN clinics.pin_hash IS 'bcrypt hash of the 4–6 digit receptionist PIN';
COMMENT ON COLUMN clinics.default_avg_consult_secs IS 'Seed value used before auto rolling average has enough data';


-- =============================================================================
-- TABLE: queue_sessions
-- One row per working day per clinic. Created fresh each morning.
-- =============================================================================

CREATE TABLE queue_sessions (
  id                  BIGSERIAL     PRIMARY KEY,
  clinic_id           BIGINT        NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  session_date        DATE          NOT NULL,
  is_active           BOOLEAN       NOT NULL DEFAULT true,       -- false = day closed
  opened_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  closed_at           TIMESTAMPTZ,                               -- set when receptionist closes day
  total_tokens_issued INT           NOT NULL DEFAULT 0,          -- denormalised counter, updated via trigger
  total_tokens_done   INT           NOT NULL DEFAULT 0,          -- denormalised counter, updated via trigger
  avg_consult_secs    INT           NOT NULL DEFAULT 600,        -- live value used for EWT computation
  avg_mode            avg_mode      NOT NULL DEFAULT 'auto',
  notes               TEXT,                                       -- e.g. "Doctor left early at 2pm"

  CONSTRAINT queue_sessions_one_per_day UNIQUE (clinic_id, session_date),
  CONSTRAINT queue_sessions_closed_after_opened CHECK (
    closed_at IS NULL OR closed_at > opened_at
  )
);

CREATE INDEX idx_sessions_clinic_date     ON queue_sessions (clinic_id, session_date DESC);
CREATE INDEX idx_sessions_clinic_active   ON queue_sessions (clinic_id, is_active) WHERE is_active = true;

COMMENT ON TABLE queue_sessions IS 'One session per clinic per working day. Token counter resets each session.';
COMMENT ON COLUMN queue_sessions.avg_consult_secs IS 'Live average used for EWT. Updated by trigger after each consultation ends.';
COMMENT ON COLUMN queue_sessions.avg_mode IS 'auto = computed from consult_time_log rolling avg. manual = receptionist override.';


-- =============================================================================
-- TABLE: patients
-- Stores patient identity. Phone number is the natural dedup key.
-- A patient returning on a different day reuses the same row.
-- =============================================================================

CREATE TABLE patients (
  id            BIGSERIAL     PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL,
  phone         VARCHAR(15),                     -- E.164 format preferred, e.g. +919876543210
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT patients_phone_unique UNIQUE (phone)   -- NULL allowed (phone optional), but if set must be unique
);

CREATE INDEX idx_patients_phone ON patients (phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_patients_name_trgm ON patients USING GIN (name gin_trgm_ops);  -- fuzzy name search

COMMENT ON TABLE patients IS 'Patient identity store. Reused across sessions if phone matches.';
COMMENT ON COLUMN patients.phone IS 'Optional. If provided, used for SMS notifications and dedup across visits.';


-- =============================================================================
-- TABLE: tokens
-- Core queue table. One row per patient per session.
-- =============================================================================

CREATE TABLE tokens (
  id                BIGSERIAL       PRIMARY KEY,
  session_id        BIGINT          NOT NULL REFERENCES queue_sessions(id) ON DELETE RESTRICT,
  clinic_id         BIGINT          NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,  -- denorm for fast filtering
  patient_id        BIGINT          NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  token_number      INT             NOT NULL,          -- T-001 within this session (resets each day)
  status            token_status    NOT NULL DEFAULT 'waiting',
  queue_order          INT             NOT NULL,          -- current queue position (reordered on skip)
  called_at         TIMESTAMPTZ,                       -- when status changed to 'serving'
  done_at           TIMESTAMPTZ,                       -- when status changed to 'done'/'skipped'/'no_show'
  requeued_from     BIGINT          REFERENCES tokens(id),  -- if this token was re-queued from a skip
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),

  CONSTRAINT tokens_unique_number_per_session UNIQUE (session_id, token_number),
  CONSTRAINT tokens_done_after_called CHECK (
    done_at IS NULL OR called_at IS NULL OR done_at >= called_at
  ),
  CONSTRAINT tokens_serving_needs_called_at CHECK (
    status != 'serving' OR called_at IS NOT NULL
  )
);

-- Performance-critical indexes — these are hit on every queue read
CREATE UNIQUE INDEX idx_tokens_session_position   ON tokens (session_id, queue_order);
CREATE INDEX idx_tokens_session_status            ON tokens (session_id, status);
CREATE INDEX idx_tokens_clinic_id                 ON tokens (clinic_id);
CREATE INDEX idx_tokens_patient_id                ON tokens (patient_id);
CREATE INDEX idx_tokens_status_waiting            ON tokens (session_id, queue_order) WHERE status = 'waiting';
CREATE INDEX idx_tokens_status_serving            ON tokens (session_id) WHERE status = 'serving';

COMMENT ON TABLE tokens IS 'One token per patient per session. The core queue entity.';
COMMENT ON COLUMN tokens.token_number IS 'Display number shown to patient (T-001). Monotonically increases per session.';
COMMENT ON COLUMN tokens.queue_order IS 'Current ordinal position in the queue. Compacted when tokens are skipped.';
COMMENT ON COLUMN tokens.requeued_from IS 'Self-referential: if patient was skipped and re-added, points to original token.';


-- =============================================================================
-- TABLE: sms_notifications
-- Tracks every SMS attempt separately from token state.
-- One token can have multiple SMS rows (e.g. "your turn soon" + "you are next").
-- =============================================================================

CREATE TABLE sms_notifications (
  id                BIGSERIAL     PRIMARY KEY,
  token_id          BIGINT        NOT NULL REFERENCES tokens(id) ON DELETE RESTRICT,
  clinic_id         BIGINT        NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,  -- denorm
  patient_id        BIGINT        NOT NULL REFERENCES patients(id) ON DELETE RESTRICT, -- denorm
  phone             VARCHAR(15)   NOT NULL,               -- snapshot of phone at time of send
  trigger_event     VARCHAR(50)   NOT NULL,               -- 'two_ahead' | 'your_turn' | 'manual'
  message_body      TEXT          NOT NULL,               -- full SMS text sent
  status            sms_status    NOT NULL DEFAULT 'pending',
  provider          VARCHAR(50),                          -- e.g. 'fast2sms', 'twilio'
  provider_msg_id   VARCHAR(255),                        -- provider's message ID for DLR tracking
  provider_response JSONB,                               -- full raw response from provider
  scheduled_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  failed_at         TIMESTAMPTZ,
  failure_reason    TEXT,
  retry_count       SMALLINT      NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT sms_one_trigger_per_token UNIQUE (token_id, trigger_event)  -- no duplicate "two_ahead" SMS
);

CREATE INDEX idx_sms_token_id         ON sms_notifications (token_id);
CREATE INDEX idx_sms_status_pending   ON sms_notifications (status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_sms_clinic_id        ON sms_notifications (clinic_id);
CREATE INDEX idx_sms_provider_msg_id  ON sms_notifications (provider_msg_id) WHERE provider_msg_id IS NOT NULL;

COMMENT ON TABLE sms_notifications IS 'Full audit log of every SMS attempt. Decoupled from token state.';
COMMENT ON COLUMN sms_notifications.trigger_event IS 'What caused this SMS: two_ahead = 2 tokens before their turn, your_turn = currently being called';
COMMENT ON COLUMN sms_notifications.provider_response IS 'Raw JSON from SMS provider stored for debugging and billing reconciliation';


-- =============================================================================
-- TABLE: consult_time_log
-- Immutable log of each completed consultation duration.
-- Used to compute rolling average for EWT.
-- =============================================================================

CREATE TABLE consult_time_log (
  id                  BIGSERIAL     PRIMARY KEY,
  clinic_id           BIGINT        NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  session_id          BIGINT        NOT NULL REFERENCES queue_sessions(id) ON DELETE RESTRICT,
  token_id            BIGINT        NOT NULL REFERENCES tokens(id) ON DELETE RESTRICT,
  duration_seconds    INT           NOT NULL,
  recorded_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT consult_time_log_token_unique UNIQUE (token_id),   -- one log per token
  CONSTRAINT consult_time_log_positive_duration CHECK (duration_seconds > 0)
);

CREATE INDEX idx_consult_log_clinic_session   ON consult_time_log (clinic_id, session_id, recorded_at DESC);
CREATE INDEX idx_consult_log_recorded_at      ON consult_time_log (recorded_at DESC);

COMMENT ON TABLE consult_time_log IS 'Append-only log of real consultation durations. Never updated, only inserted.';
COMMENT ON COLUMN consult_time_log.duration_seconds IS 'Actual time from called_at to done_at for this token. Source of truth for EWT.';


-- =============================================================================
-- TABLE: receptionist_actions
-- Audit log of every action taken by the receptionist.
-- Useful for debugging, dispute resolution, and analytics.
-- =============================================================================

CREATE TABLE receptionist_actions (
  id            BIGSERIAL     PRIMARY KEY,
  clinic_id     BIGINT        NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  session_id    BIGINT        REFERENCES queue_sessions(id),
  token_id      BIGINT        REFERENCES tokens(id),
  action        VARCHAR(50)   NOT NULL,   -- 'add_patient' | 'call_next' | 'skip' | 'no_show' | 'requeue' | 'set_avg_time' | 'open_session' | 'close_session'
  payload       JSONB,                    -- snapshot of relevant data at time of action
  performed_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT receptionist_actions_valid CHECK (
    action IN ('add_patient','call_next','skip','no_show','requeue','set_avg_time','open_session','close_session')
  )
);

CREATE INDEX idx_actions_clinic_session   ON receptionist_actions (clinic_id, session_id, performed_at DESC);
CREATE INDEX idx_actions_token_id         ON receptionist_actions (token_id) WHERE token_id IS NOT NULL;
CREATE INDEX idx_actions_performed_at     ON receptionist_actions (performed_at DESC);

COMMENT ON TABLE receptionist_actions IS 'Full immutable audit trail of receptionist operations. Never updated or deleted.';


-- =============================================================================
-- SEQUENCES
-- Per-clinic-per-session token number counter.
-- Using advisory locks + this sequence table is safer than relying on MAX()+1.
-- =============================================================================

CREATE TABLE token_sequences (
  clinic_id     BIGINT    NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  session_id    BIGINT    NOT NULL REFERENCES queue_sessions(id) ON DELETE RESTRICT,
  last_number   INT       NOT NULL DEFAULT 0,

  PRIMARY KEY (clinic_id, session_id)
);

COMMENT ON TABLE token_sequences IS 'Per-session token counter. Atomically incremented to avoid duplicate token numbers under concurrency.';


-- =============================================================================
-- FUNCTION: register_clinic
-- Registers a new clinic. Idempotent on slug conflict.
-- =============================================================================

CREATE OR REPLACE FUNCTION register_clinic(
  p_name                    VARCHAR(255),
  p_slug                    VARCHAR(100),
  p_phone                   VARCHAR(15),
  p_address                 TEXT,
  p_pin                     VARCHAR(10),           -- plain PIN, hashed inside function
  p_timezone                VARCHAR(60)  DEFAULT 'Asia/Kolkata',
  p_default_avg_consult_secs INT         DEFAULT 600
)
RETURNS TABLE (
  clinic_id   BIGINT,
  slug        VARCHAR,
  created     BOOLEAN   -- true = newly created, false = already existed
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id        BIGINT;
  v_created   BOOLEAN := false;
BEGIN
  -- Check if slug already exists
  SELECT id INTO v_id FROM clinics c WHERE c.slug = p_slug;

  IF v_id IS NULL THEN
    INSERT INTO clinics (
      name, slug, phone, address, pin_hash,
      timezone, default_avg_consult_secs
    )
    VALUES (
      p_name,
      p_slug,
      p_phone,
      p_address,
      crypt(p_pin, gen_salt('bf', 10)),   -- bcrypt with cost 10
      p_timezone,
      p_default_avg_consult_secs
    )
    RETURNING id INTO v_id;

    v_created := true;
  END IF;

  RETURN QUERY SELECT v_id, p_slug, v_created;
END;
$$;

COMMENT ON FUNCTION register_clinic IS 'Registers a new clinic. Call once per clinic. Idempotent — returns existing record if slug already taken.';


-- =============================================================================
-- FUNCTION: open_session
-- Creates a new working day session for a clinic.
-- Idempotent — returns existing session if already opened today.
-- =============================================================================

CREATE OR REPLACE FUNCTION open_session(
  p_clinic_id   BIGINT,
  p_date        DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  session_id    BIGINT,
  session_date  DATE,
  created       BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id    BIGINT;
  v_created       BOOLEAN := false;
  v_seed_secs     INT;
BEGIN
  -- Check if session already exists for today
  SELECT id INTO v_session_id
  FROM queue_sessions
  WHERE clinic_id = p_clinic_id AND queue_sessions.session_date = p_date;

  IF v_session_id IS NULL THEN
    -- Fetch clinic's seed average
    SELECT default_avg_consult_secs INTO v_seed_secs
    FROM clinics WHERE id = p_clinic_id;

    INSERT INTO queue_sessions (clinic_id, session_date, avg_consult_secs)
    VALUES (p_clinic_id, p_date, v_seed_secs)
    RETURNING id INTO v_session_id;

    -- Initialise token sequence for this session
    INSERT INTO token_sequences (clinic_id, session_id, last_number)
    VALUES (p_clinic_id, v_session_id, 0);

    -- Audit log
    INSERT INTO receptionist_actions (clinic_id, session_id, action, payload)
    VALUES (p_clinic_id, v_session_id, 'open_session',
            jsonb_build_object('date', p_date));

    v_created := true;
  END IF;

  RETURN QUERY SELECT v_session_id, p_date, v_created;
END;
$$;

COMMENT ON FUNCTION open_session IS 'Opens a new daily session. Idempotent — safe to call multiple times.';


-- =============================================================================
-- FUNCTION: add_patient_to_queue
-- Looks up or creates patient, then issues a new token for the session.
-- The critical path — must be fast and race-condition-safe.
-- =============================================================================

CREATE OR REPLACE FUNCTION add_patient_to_queue(
  p_clinic_id     BIGINT,
  p_session_id    BIGINT,
  p_name          VARCHAR(255),
  p_phone         VARCHAR(15) DEFAULT NULL
)
RETURNS TABLE (
  token_id        BIGINT,
  token_number    INT,
  patient_id      BIGINT,
  queue_order        INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient_id    BIGINT;
  v_token_number  INT;
  v_queue_order      INT;
  v_token_id      BIGINT;
BEGIN
  -- Step 1: Upsert patient (dedup on phone if provided)
  IF p_phone IS NOT NULL THEN
    INSERT INTO patients (name, phone)
    VALUES (p_name, p_phone)
    ON CONFLICT (phone) DO UPDATE
      SET name = EXCLUDED.name,
          updated_at = now()
    RETURNING id INTO v_patient_id;
  ELSE
    INSERT INTO patients (name, phone)
    VALUES (p_name, NULL)
    RETURNING id INTO v_patient_id;
  END IF;

  -- Step 2: Atomically increment token sequence (row-level lock on sequence row)
  UPDATE token_sequences
  SET last_number = last_number + 1
  WHERE clinic_id = p_clinic_id AND session_id = p_session_id
  RETURNING last_number INTO v_token_number;

  IF v_token_number IS NULL THEN
    RAISE EXCEPTION 'No active token sequence found for clinic_id=% session_id=%',
      p_clinic_id, p_session_id;
  END IF;

  -- Step 3: queue_order = next available slot (max queue_order + 1 among waiting/serving)
  SELECT COALESCE(MAX(t.queue_order), 0) + 1
  INTO v_queue_order
  FROM tokens t
  WHERE t.session_id = p_session_id
    AND t.status IN ('waiting', 'serving');

  -- Step 4: Insert token
  INSERT INTO tokens (
    session_id, clinic_id, patient_id,
    token_number, queue_order, status
  )
  VALUES (
    p_session_id, p_clinic_id, v_patient_id,
    v_token_number, v_queue_order, 'waiting'
  )
  RETURNING id INTO v_token_id;

  -- Step 5: Update session counter (denormalised, fast reads)
  UPDATE queue_sessions
  SET total_tokens_issued = total_tokens_issued + 1
  WHERE id = p_session_id;

  -- Step 6: Audit log
  INSERT INTO receptionist_actions (clinic_id, session_id, token_id, action, payload)
  VALUES (
    p_clinic_id, p_session_id, v_token_id, 'add_patient',
    jsonb_build_object(
      'patient_id', v_patient_id,
      'token_number', v_token_number,
      'queue_order', v_queue_order
    )
  );

  RETURN QUERY SELECT v_token_id, v_token_number, v_patient_id, v_queue_order;
END;
$$;

COMMENT ON FUNCTION add_patient_to_queue IS 'Atomically adds a patient and issues a token. Safe under concurrent receptionist operations.';


-- =============================================================================
-- FUNCTION: call_next_token
-- Marks current serving token as done, calls next waiting token.
-- Computes and logs consultation duration, updates rolling average.
-- =============================================================================

CREATE OR REPLACE FUNCTION call_next_token(
  p_clinic_id   BIGINT,
  p_session_id  BIGINT
)
RETURNS TABLE (
  called_token_id     BIGINT,
  called_token_number INT,
  patient_name        VARCHAR,
  new_avg_secs        INT,
  tokens_remaining    INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_serving_token_id    BIGINT;
  v_serving_called_at   TIMESTAMPTZ;
  v_duration_secs       INT;
  v_next_token_id       BIGINT;
  v_next_token_number   INT;
  v_patient_name        VARCHAR;
  v_rolling_avg         INT;
  v_tokens_remaining    INT;
BEGIN
  -- Step 1: Find currently serving token (if any)
  SELECT id, called_at INTO v_serving_token_id, v_serving_called_at
  FROM tokens
  WHERE session_id = p_session_id AND status = 'serving'
  LIMIT 1;

  IF v_serving_token_id IS NOT NULL THEN
    -- Mark it done
    UPDATE tokens
    SET status = 'done', done_at = now()
    WHERE id = v_serving_token_id;

    UPDATE queue_sessions
    SET total_tokens_done = total_tokens_done + 1
    WHERE id = p_session_id;

    -- Compute actual duration
    v_duration_secs := EXTRACT(EPOCH FROM (now() - v_serving_called_at))::INT;

    -- Log it (append-only)
    INSERT INTO consult_time_log (clinic_id, session_id, token_id, duration_seconds)
    VALUES (p_clinic_id, p_session_id, v_serving_token_id, v_duration_secs)
    ON CONFLICT (token_id) DO NOTHING;
  END IF;

  -- Step 2: Find next waiting token (lowest queue_order)
  SELECT t.id, t.token_number, p.name
  INTO v_next_token_id, v_next_token_number, v_patient_name
  FROM tokens t
  JOIN patients p ON p.id = t.patient_id
  WHERE t.session_id = p_session_id AND t.status = 'waiting'
  ORDER BY t.queue_order ASC
  LIMIT 1;

  IF v_next_token_id IS NULL THEN
    -- Queue is empty
    RETURN QUERY SELECT NULL::BIGINT, NULL::INT, NULL::VARCHAR, NULL::INT, 0;
    RETURN;
  END IF;

  -- Step 3: Call the next token
  UPDATE tokens
  SET status = 'serving', called_at = now()
  WHERE id = v_next_token_id;

  -- Step 4: Recompute rolling average from last 5 consultations (if auto mode)
  IF EXISTS (
    SELECT 1 FROM queue_sessions
    WHERE id = p_session_id AND avg_mode = 'auto'
  ) THEN
    SELECT COALESCE(AVG(duration_seconds)::INT, NULL)
    INTO v_rolling_avg
    FROM (
      SELECT duration_seconds
      FROM consult_time_log
      WHERE clinic_id = p_clinic_id AND session_id = p_session_id
      ORDER BY recorded_at DESC
      LIMIT 5
    ) recent;

    IF v_rolling_avg IS NOT NULL THEN
      UPDATE queue_sessions
      SET avg_consult_secs = v_rolling_avg
      WHERE id = p_session_id;
    END IF;
  END IF;

  -- Step 5: Count remaining waiting tokens
  SELECT COUNT(*) INTO v_tokens_remaining
  FROM tokens
  WHERE session_id = p_session_id AND status = 'waiting';

  -- Step 6: Fetch updated avg
  SELECT avg_consult_secs INTO v_rolling_avg
  FROM queue_sessions WHERE id = p_session_id;

  -- Step 7: Audit log
  INSERT INTO receptionist_actions (clinic_id, session_id, token_id, action, payload)
  VALUES (
    p_clinic_id, p_session_id, v_next_token_id, 'call_next',
    jsonb_build_object(
      'previous_serving_id', v_serving_token_id,
      'previous_duration_secs', v_duration_secs,
      'called_token_id', v_next_token_id,
      'called_token_number', v_next_token_number
    )
  );

  RETURN QUERY
  SELECT v_next_token_id, v_next_token_number, v_patient_name,
         v_rolling_avg, v_tokens_remaining;
END;
$$;

COMMENT ON FUNCTION call_next_token IS 'Closes current serving token, opens next one, logs duration, recomputes rolling average. Single atomic operation.';


-- =============================================================================
-- FUNCTION: skip_token
-- Marks a token as skipped and compacts the queue_order sequence.
-- =============================================================================

CREATE OR REPLACE FUNCTION skip_token(
  p_token_id    BIGINT,
  p_clinic_id   BIGINT,
  p_session_id  BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_skipped_queue_order INT;
BEGIN
  SELECT queue_order INTO v_skipped_queue_order
  FROM tokens WHERE id = p_token_id;

  IF v_skipped_queue_order IS NULL THEN
    RAISE EXCEPTION 'Token % not found', p_token_id;
  END IF;

  -- Mark as skipped
  UPDATE tokens
  SET status = 'skipped', done_at = now()
  WHERE id = p_token_id AND status = 'waiting';

  -- Compact positions: decrement all waiting tokens that were behind the skipped one
  UPDATE tokens
  SET queue_order = queue_order - 1
  WHERE session_id = p_session_id
    AND status = 'waiting'
    AND queue_order > v_skipped_queue_order;

  -- Audit
  INSERT INTO receptionist_actions (clinic_id, session_id, token_id, action, payload)
  VALUES (
    p_clinic_id, p_session_id, p_token_id, 'skip',
    jsonb_build_object('skipped_queue_order', v_skipped_queue_order)
  );
END;
$$;

COMMENT ON FUNCTION skip_token IS 'Marks a token as skipped and reorders remaining queue positions.';


-- =============================================================================
-- FUNCTION: set_avg_consult_time (manual override)
-- =============================================================================

CREATE OR REPLACE FUNCTION set_avg_consult_time(
  p_clinic_id   BIGINT,
  p_session_id  BIGINT,
  p_seconds     INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_seconds <= 0 THEN
    RAISE EXCEPTION 'avg_consult_time must be positive';
  END IF;

  UPDATE queue_sessions
  SET avg_consult_secs = p_seconds,
      avg_mode = 'manual'
  WHERE id = p_session_id AND clinic_id = p_clinic_id;

  INSERT INTO receptionist_actions (clinic_id, session_id, action, payload)
  VALUES (
    p_clinic_id, p_session_id, 'set_avg_time',
    jsonb_build_object('seconds', p_seconds, 'mode', 'manual')
  );
END;
$$;

COMMENT ON FUNCTION set_avg_consult_time IS 'Receptionist manual override for average consultation time.';


-- =============================================================================
-- FUNCTION: get_queue_state
-- Returns full live queue snapshot. Called by Go WebSocket hub on every change.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_queue_state(
  p_session_id  BIGINT
)
RETURNS TABLE (
  token_id          BIGINT,
  token_number      INT,
  patient_name      VARCHAR,
  status            token_status,
  queue_order          INT,
  called_at         TIMESTAMPTZ,
  tokens_ahead      INT,           -- for each waiting token: how many are before it
  est_wait_seconds  INT,           -- estimated wait in seconds
  sms_status        TEXT           -- latest SMS status for this token
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_avg_secs  INT;
BEGIN
  SELECT avg_consult_secs INTO v_avg_secs
  FROM queue_sessions WHERE id = p_session_id;

  RETURN QUERY
  SELECT
    t.id,
    t.token_number,
    p.name,
    t.status,
    t.queue_order,
    t.called_at,
    CASE
      WHEN t.status = 'waiting' THEN
        (t.queue_order - MIN(t2.queue_order) OVER (
          PARTITION BY t.session_id
        ))::INT
      ELSE NULL
    END AS tokens_ahead,
    CASE
      WHEN t.status = 'waiting' THEN
        (t.queue_order - MIN(t2.queue_order) OVER (
          PARTITION BY t.session_id
        )) * v_avg_secs
      ELSE NULL
    END AS est_wait_seconds,
    (
      SELECT sn.status::TEXT
      FROM sms_notifications sn
      WHERE sn.token_id = t.id
      ORDER BY sn.created_at DESC
      LIMIT 1
    ) AS sms_status
  FROM tokens t
  JOIN patients p ON p.id = t.patient_id
  -- Self-join alias for window function minimum queue_order among waiting
  JOIN tokens t2 ON t2.session_id = t.session_id AND t2.status IN ('waiting','serving')
  WHERE t.session_id = p_session_id
    AND t.status IN ('waiting', 'serving')
  GROUP BY t.id, t.token_number, p.name, t.status,
           t.queue_order, t.called_at, t.session_id
  ORDER BY t.queue_order ASC;
END;
$$;

COMMENT ON FUNCTION get_queue_state IS 'Full live queue snapshot with EWT per token. Called on every state change to broadcast via WebSocket.';


-- =============================================================================
-- FUNCTION: close_session
-- Ends the working day. Marks session inactive.
-- =============================================================================

CREATE OR REPLACE FUNCTION close_session(
  p_clinic_id   BIGINT,
  p_session_id  BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE queue_sessions
  SET is_active = false, closed_at = now()
  WHERE id = p_session_id AND clinic_id = p_clinic_id;

  -- Mark all remaining waiting tokens as no_show
  UPDATE tokens
  SET status = 'no_show', done_at = now()
  WHERE session_id = p_session_id AND status = 'waiting';

  INSERT INTO receptionist_actions (clinic_id, session_id, action, payload)
  VALUES (
    p_clinic_id, p_session_id, 'close_session',
    jsonb_build_object('closed_at', now())
  );
END;
$$;

COMMENT ON FUNCTION close_session IS 'Closes the day. Remaining waiting tokens become no_show. Irreversible.';


-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger: auto-update updated_at on clinics and patients
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clinics_updated_at
  BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- VIEWS
-- =============================================================================

-- Receptionist dashboard view: today's session summary
CREATE OR REPLACE VIEW v_today_session_summary AS
SELECT
  c.id            AS clinic_id,
  c.name          AS clinic_name,
  c.slug,
  qs.id           AS session_id,
  qs.session_date,
  qs.is_active,
  qs.avg_consult_secs,
  qs.avg_mode,
  qs.total_tokens_issued,
  qs.total_tokens_done,
  (qs.total_tokens_issued - qs.total_tokens_done) AS tokens_remaining,
  (SELECT token_number FROM tokens
   WHERE session_id = qs.id AND status = 'serving'
   LIMIT 1)       AS currently_serving_token
FROM clinics c
JOIN queue_sessions qs ON qs.clinic_id = c.id
WHERE qs.session_date = CURRENT_DATE;

COMMENT ON VIEW v_today_session_summary IS 'Quick receptionist dashboard — one row per clinic for today.';


-- Analytics view: per-session stats (for doctor dashboard / owner reports)
CREATE OR REPLACE VIEW v_session_analytics AS
SELECT
  qs.clinic_id,
  c.name              AS clinic_name,
  qs.id               AS session_id,
  qs.session_date,
  qs.total_tokens_issued,
  qs.total_tokens_done,
  COUNT(t.id) FILTER (WHERE t.status = 'skipped')     AS skipped,
  COUNT(t.id) FILTER (WHERE t.status = 'no_show')     AS no_shows,
  ROUND(AVG(ctl.duration_seconds)::NUMERIC, 0)::INT   AS actual_avg_consult_secs,
  MIN(ctl.duration_seconds)                            AS min_consult_secs,
  MAX(ctl.duration_seconds)                            AS max_consult_secs,
  qs.opened_at,
  qs.closed_at
FROM queue_sessions qs
JOIN clinics c ON c.id = qs.clinic_id
LEFT JOIN tokens t ON t.session_id = qs.id
LEFT JOIN consult_time_log ctl ON ctl.session_id = qs.id
GROUP BY qs.clinic_id, c.name, qs.id, qs.session_date,
         qs.total_tokens_issued, qs.total_tokens_done,
         qs.opened_at, qs.closed_at;

COMMENT ON VIEW v_session_analytics IS 'Per-session performance report for clinic owner and doctor dashboards.';


-- =============================================================================
-- SAMPLE USAGE (commented — for reference only)
-- =============================================================================

/*

-- 1. Register a clinic once
SELECT * FROM register_clinic(
  'Dr. Patel General Clinic',
  'dr-patel-ward7',
  '+912345678901',
  '12, Gandhi Chowk, Ahmedabad',
  '4821',
  'Asia/Kolkata',
  600
);
-- Returns: clinic_id=1, slug='dr-patel-ward7', created=true

-- 2. Open today's session (call every morning)
SELECT * FROM open_session(1);
-- Returns: session_id=1, session_date=today, created=true

-- 3. Add patients to queue (under 10 seconds for receptionist)
SELECT * FROM add_patient_to_queue(1, 1, 'Ramesh Patel', '+919876543210');
-- Returns: token_id=1, token_number=1, patient_id=1, queue_order=1

SELECT * FROM add_patient_to_queue(1, 1, 'Sunita Shah', '+919876543211');
-- Returns: token_id=2, token_number=2, patient_id=2, queue_order=2

SELECT * FROM add_patient_to_queue(1, 1, 'Mohan Verma', NULL);
-- Returns: token_id=3, token_number=3, patient_id=3, queue_order=3

-- 4. Call next token (receptionist clicks "Call Next")
SELECT * FROM call_next_token(1, 1);
-- Token 1 is now 'serving', rolling avg recalculated

-- 5. Get live queue state (WebSocket broadcast payload)
SELECT * FROM get_queue_state(1);

-- 6. Skip a token
SELECT skip_token(2, 1, 1);

-- 7. Manual average override
SELECT set_avg_consult_time(1, 1, 480);  -- override to 8 minutes

-- 8. Close the day
SELECT close_session(1, 1);

*/