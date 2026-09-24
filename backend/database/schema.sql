-- ============================================================
-- TrackInstall Database Schema
-- PostgreSQL 18+
-- ============================================================

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'ADMIN',
    'INSTALLER'
);

CREATE TYPE job_status AS ENUM (
    'ASSIGNED',
    'COMPLETED',
    'PAID'
);

CREATE TYPE payment_status AS ENUM (
    'NOT_READY',
    'PAYMENT_PENDING',
    'PAID'
);

CREATE TYPE visit_type AS ENUM (
    'NORMAL',
    'EXTRA'
);

CREATE TYPE visit_status AS ENUM (
    'COMPLETED',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED'
);

CREATE TYPE payment_record_status AS ENUM (
    'PENDING',
    'PAID'
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,

    email VARCHAR(255) UNIQUE,

    phone_number VARCHAR(20) NOT NULL UNIQUE,
    
    password_hash TEXT,
    
    role user_role NOT NULL,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    activation_token_hash TEXT,
    
    activation_expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_activation_token_hash
    ON users(activation_token_hash);

-- ============================================================
-- CITIES
-- ============================================================

CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL UNIQUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INSTALLERS
-- ============================================================

CREATE TABLE installers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE
        REFERENCES users(id)
        ON DELETE RESTRICT,

    city_id UUID NOT NULL
        REFERENCES cities(id)
        ON DELETE RESTRICT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DOOR TYPES
-- ============================================================

CREATE TABLE door_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL UNIQUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INSTALLER MASTER CHARGES
-- Current rates used for NEW assignments.
-- Historical jobs keep their own snapshots.
-- ============================================================

CREATE TABLE installer_door_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    installer_id UUID NOT NULL
        REFERENCES installers(id)
        ON DELETE RESTRICT,

    door_type_id UUID NOT NULL
        REFERENCES door_types(id)
        ON DELETE RESTRICT,

    installation_charge NUMERIC(12,2) NOT NULL
        CHECK (installation_charge >= 0),

    visiting_charge NUMERIC(12,2) NOT NULL
        CHECK (visiting_charge >= 0),

    effective_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (installer_id, door_type_id, effective_from)
);

-- ============================================================
-- JOBS / SITE ASSIGNMENTS
-- ============================================================

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id VARCHAR(100) NOT NULL UNIQUE,

    site_name VARCHAR(200) NOT NULL,

    customer_name VARCHAR(200) NOT NULL,

    contact_number VARCHAR(20) NOT NULL,

    address TEXT NOT NULL,

    city_id UUID NOT NULL
        REFERENCES cities(id)
        ON DELETE RESTRICT,

    installer_id UUID NOT NULL
        REFERENCES installers(id)
        ON DELETE RESTRICT,

    status job_status NOT NULL DEFAULT 'ASSIGNED',

    payment_status payment_status NOT NULL DEFAULT 'NOT_READY',

    visiting_charge_snapshot NUMERIC(12,2) NOT NULL
        CHECK (visiting_charge_snapshot >= 0),

    expected_visits INTEGER NOT NULL DEFAULT 0
        CHECK (expected_visits >= 0),

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- JOB DOOR ITEMS
-- Installation charge is SNAPSHOTTED at assignment time.
-- ============================================================

CREATE TABLE job_door_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_id UUID NOT NULL
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    door_type_id UUID NOT NULL
        REFERENCES door_types(id)
        ON DELETE RESTRICT,

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    installation_charge_snapshot NUMERIC(12,2) NOT NULL
        CHECK (installation_charge_snapshot >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- VISIT REASONS
-- ============================================================

CREATE TABLE visit_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL UNIQUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- VISITS
-- ============================================================

CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_id UUID NOT NULL
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    installer_id UUID NOT NULL
        REFERENCES installers(id)
        ON DELETE RESTRICT,

    visit_number INTEGER NOT NULL
        CHECK (visit_number > 0),

    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,

    type visit_type NOT NULL,

    status visit_status NOT NULL,

    reason_id UUID
        REFERENCES visit_reasons(id)
        ON DELETE RESTRICT,

    remark TEXT,

    visiting_charge_snapshot NUMERIC(12,2) NOT NULL
        CHECK (visiting_charge_snapshot >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (job_id, visit_number)
);

-- ============================================================
-- ORDER FILES
-- ============================================================

CREATE TABLE order_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_id UUID NOT NULL
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    file_name VARCHAR(255) NOT NULL,

    file_type VARCHAR(100) NOT NULL,

    file_url TEXT NOT NULL,

    uploaded_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_id UUID NOT NULL UNIQUE
        REFERENCES jobs(id)
        ON DELETE RESTRICT,

    installation_amount NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (installation_amount >= 0),

    normal_visit_amount NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (normal_visit_amount >= 0),

    extra_visit_amount NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (extra_visit_amount >= 0),

    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (total_amount >= 0),

    status payment_record_status NOT NULL DEFAULT 'PENDING',

    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- AUDIT LOGS
-- One record = one user action/edit.
-- old_value/new_value store all changed fields as JSONB.
-- ============================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,

    entity_type VARCHAR(100) NOT NULL,

    entity_id UUID NOT NULL,

    old_value JSONB,

    new_value JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_installers_city_id
    ON installers(city_id);

CREATE INDEX idx_installer_door_charges_installer_id
    ON installer_door_charges(installer_id);

CREATE INDEX idx_installer_door_charges_door_type_id
    ON installer_door_charges(door_type_id);

CREATE INDEX idx_jobs_city_id
    ON jobs(city_id);

CREATE INDEX idx_jobs_installer_id
    ON jobs(installer_id);

CREATE INDEX idx_jobs_status
    ON jobs(status);

CREATE INDEX idx_jobs_payment_status
    ON jobs(payment_status);

CREATE INDEX idx_job_door_items_job_id
    ON job_door_items(job_id);

CREATE INDEX idx_visits_job_id
    ON visits(job_id);

CREATE INDEX idx_visits_installer_id
    ON visits(installer_id);

CREATE INDEX idx_visits_status
    ON visits(status);

CREATE INDEX idx_order_files_job_id
    ON order_files(job_id);

CREATE INDEX idx_audit_logs_entity
    ON audit_logs(entity_type, entity_id);

CREATE INDEX idx_audit_logs_user_id
    ON audit_logs(user_id);

-- ============================================================
-- SEED: DOOR TYPES
-- ============================================================

INSERT INTO door_types (name)
VALUES
    ('Single Leaf Dead Lock'),
    ('Single Leaf Panic Bar'),
    ('Double Leaf Dead Lock'),
    ('Double Leaf Panic Bar'),
    ('Glass Door');

-- ============================================================
-- SEED: VISIT REASONS
-- ============================================================

INSERT INTO visit_reasons (name)
VALUES
    ('Customer unavailable'),
    ('Material unavailable'),
    ('Site not ready'),
    ('Rework/Correction'),
    ('Installation incomplete'),
    ('Customer requested additional visit'),
    ('Technical issue'),
    ('Other');
    