"""
Initial migration: Phase 0 core schema
Creates: tenants, company_settings, company_offices, departments,
         users, roles, permissions, user_roles, role_permissions, refresh_tokens,
         audit_logs, security_events

Also applies PostgreSQL Row-Level Security (RLS) policies on all tenant-owned tables.
"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── TENANTS ──────────────────────────────────────────────────────────────
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("company_slug", sa.String(100), nullable=False),
        sa.Column("legal_name", sa.String(255)),
        sa.Column("industry", sa.String(100)),
        sa.Column("company_size", sa.String(50)),
        sa.Column("website", sa.String(500)),
        sa.Column("email_domain", sa.String(255)),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending_setup"),
        sa.Column("is_sandbox", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("plan", sa.String(50), nullable=False, server_default="trial"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_unique_constraint("uq_tenants_slug", "tenants", ["company_slug"])
    op.create_index("ix_tenants_company_slug", "tenants", ["company_slug"])

    # ─── COMPANY SETTINGS ─────────────────────────────────────────────────────
    op.create_table(
        "company_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("autonomy_level", sa.String(30), nullable=False, server_default="ASSISTED"),
        sa.Column("headquarters_country", sa.String(100)),
        sa.Column("headquarters_city", sa.String(100)),
        sa.Column("operating_countries", postgresql.JSONB),
        sa.Column("hiring_countries", postgresql.JSONB),
        sa.Column("time_zones", postgresql.JSONB),
        sa.Column("working_hours", postgresql.JSONB),
        sa.Column("holidays", postgresql.JSONB),
        sa.Column("notice_period_days_default", sa.Integer, server_default="30"),
        sa.Column("offer_approval_required", sa.Boolean, server_default="true"),
        sa.Column("background_verification_required", sa.Boolean, server_default="true"),
        sa.Column("proctoring_enabled", sa.Boolean, server_default="false"),
        sa.Column("ai_interview_enabled", sa.Boolean, server_default="false"),
        sa.Column("voice_calls_enabled", sa.Boolean, server_default="false"),
        sa.Column("kill_automated_rejections", sa.Boolean, server_default="false"),
        sa.Column("kill_proctoring", sa.Boolean, server_default="false"),
        sa.Column("kill_voice_calls", sa.Boolean, server_default="false"),
        sa.Column("kill_all_workflows", sa.Boolean, server_default="false"),
        sa.Column("recruiter_display_name", sa.String(255)),
        sa.Column("sender_email", sa.String(255)),
        sa.Column("daily_ai_budget_usd", sa.Float),
        sa.Column("monthly_ai_budget_usd", sa.Float),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_company_settings_tenant", "company_settings", ["tenant_id"])

    # ─── COMPANY OFFICES ──────────────────────────────────────────────────────
    op.create_table(
        "company_offices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("address_line1", sa.String(500)),
        sa.Column("address_line2", sa.String(500)),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("state", sa.String(100)),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("postal_code", sa.String(20)),
        sa.Column("time_zone", sa.String(100)),
        sa.Column("maps_url", sa.Text),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_company_offices_tenant", "company_offices", ["tenant_id"])

    # ─── DEPARTMENTS ──────────────────────────────────────────────────────────
    op.create_table(
        "departments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("parent_department_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_departments_tenant", "departments", ["tenant_id"])

    # ─── PERMISSIONS ──────────────────────────────────────────────────────────
    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.String(500)),
        sa.Column("resource", sa.String(100), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ─── ROLES ────────────────────────────────────────────────────────────────
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("is_system_role", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ─── ROLE PERMISSIONS (M2M) ───────────────────────────────────────────────
    op.create_table(
        "role_permissions",
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    )

    # ─── USERS ────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(1024), nullable=False),
        sa.Column("full_name", sa.String(500), nullable=False),
        sa.Column("phone", sa.String(50)),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("is_platform_admin", sa.Boolean, server_default="false"),
        sa.Column("mfa_enabled", sa.Boolean, server_default="false"),
        sa.Column("mfa_secret", sa.String(500)),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("failed_login_attempts", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_tenant", "users", ["tenant_id"])
    op.create_unique_constraint("uq_users_email_tenant", "users", ["email", "tenant_id"])

    # ─── USER ROLES (M2M) ─────────────────────────────────────────────────────
    op.create_table(
        "user_roles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    )

    # ─── REFRESH TOKENS ───────────────────────────────────────────────────────
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(1024), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_revoked", sa.Boolean, server_default="false"),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_refresh_tokens_user", "refresh_tokens", ["user_id"])

    # ─── AUDIT LOGS ───────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True)),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True)),
        sa.Column("actor_type", sa.String(50), nullable=False),
        sa.Column("action", sa.String(200), nullable=False),
        sa.Column("entity_type", sa.String(100)),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("reason_code", sa.String(200)),
        sa.Column("reason_summary", sa.Text),
        sa.Column("input_references", postgresql.JSONB),
        sa.Column("output_summary", postgresql.JSONB),
        sa.Column("agent_name", sa.String(200)),
        sa.Column("agent_version", sa.String(50)),
        sa.Column("prompt_version", sa.String(50)),
        sa.Column("workflow_version", sa.String(50)),
        sa.Column("model_version", sa.String(100)),
        sa.Column("correlation_id", sa.String(100)),
        sa.Column("causation_id", sa.String(100)),
        sa.Column("ip_address", sa.String(50)),
        sa.Column("user_agent", sa.String(500)),
        sa.Column("status", sa.String(50), nullable=False, server_default="success"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_audit_logs_tenant", "audit_logs", ["tenant_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_correlation", "audit_logs", ["correlation_id"])

    # ─── SECURITY EVENTS ──────────────────────────────────────────────────────
    op.create_table(
        "security_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True)),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("ip_address", sa.String(50)),
        sa.Column("user_agent", sa.String(500)),
        sa.Column("path", sa.String(500)),
        sa.Column("details", postgresql.JSONB),
        sa.Column("resolved", sa.Boolean, server_default="false"),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_security_events_tenant", "security_events", ["tenant_id"])
    op.create_index("ix_security_events_type", "security_events", ["event_type"])

    # ══════════════════════════════════════════════════════════════════════════
    # POSTGRESQL ROW-LEVEL SECURITY (RLS)
    # Applied on all tables with tenant_id columns.
    # ══════════════════════════════════════════════════════════════════════════
    tenant_tables = [
        "company_settings",
        "company_offices",
        "departments",
        "users",
        "audit_logs",
        "security_events",
    ]

    conn = op.get_bind()
    for table in tenant_tables:
        conn.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        conn.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
        conn.execute(sa.text(f"""
            CREATE POLICY tenant_isolation ON {table}
            USING (
                tenant_id = NULLIF(
                    current_setting('app.current_tenant_id', true), ''
                )::uuid
                OR current_setting('app.bypass_rls', true) = 'true'
            )
        """))

    # ─── SEED SYSTEM ROLES AND PERMISSIONS ───────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO roles (id, name, display_name, description, is_system_role, created_at, updated_at)
        VALUES
            (gen_random_uuid(), 'platform_admin', 'Platform Administrator', 'Full platform access', true, now(), now()),
            (gen_random_uuid(), 'tenant_admin', 'Company Administrator', 'Full access within a tenant', true, now(), now()),
            (gen_random_uuid(), 'hr_manager', 'HR Manager', 'Manages hiring and HR operations', true, now(), now()),
            (gen_random_uuid(), 'hr_recruiter', 'Recruiter', 'Manages candidate pipeline', true, now(), now()),
            (gen_random_uuid(), 'hiring_manager', 'Hiring Manager', 'Reviews and approves candidates for their teams', true, now(), now()),
            (gen_random_uuid(), 'interviewer', 'Interviewer', 'Conducts and scores interviews', true, now(), now()),
            (gen_random_uuid(), 'employee', 'Employee', 'Standard employee access', true, now(), now())
        ON CONFLICT (name) DO NOTHING
    """))


def downgrade() -> None:
    # Remove RLS first
    tenant_tables = [
        "company_settings", "company_offices", "departments",
        "users", "audit_logs", "security_events",
    ]
    conn = op.get_bind()
    for table in tenant_tables:
        try:
            conn.execute(sa.text(f"DROP POLICY IF EXISTS tenant_isolation ON {table}"))
            conn.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
        except Exception:
            pass

    op.drop_table("security_events")
    op.drop_table("audit_logs")
    op.drop_table("refresh_tokens")
    op.drop_table("user_roles")
    op.drop_table("users")
    op.drop_table("role_permissions")
    op.drop_table("roles")
    op.drop_table("permissions")
    op.drop_table("departments")
    op.drop_table("company_offices")
    op.drop_table("company_settings")
    op.drop_table("tenants")
