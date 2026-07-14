"""
Phase 1 Database Migration
Adds: teams, policy_documents, policy_versions, company_integrations, setup_wizard_states
Applies RLS on all new tenant-scoped tables.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0002_phase1_company"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _apply_rls(conn, table: str) -> None:
    conn.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
    conn.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
    conn.execute(sa.text(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR current_setting('app.bypass_rls', true) = 'true'
        )
    """))


def upgrade() -> None:
    # ─── TEAMS ────────────────────────────────────────────────────────────────
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("departments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("team_lead_user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("headcount_target", sa.Integer),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_teams_tenant", "teams", ["tenant_id"])
    op.create_index("ix_teams_department", "teams", ["department_id"])

    # ─── POLICY DOCUMENTS ─────────────────────────────────────────────────────
    op.create_table(
        "policy_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("current_published_version_id", postgresql.UUID(as_uuid=True)),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("policy_owner_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("requires_legal_review", sa.Boolean, server_default="false"),
        sa.Column("applies_to", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_policy_documents_tenant", "policy_documents", ["tenant_id"])
    op.create_index("ix_policy_documents_slug", "policy_documents", ["slug"])
    op.create_unique_constraint(
        "uq_policy_slug_per_tenant", "policy_documents", ["tenant_id", "slug"]
    )

    # ─── POLICY VERSIONS ──────────────────────────────────────────────────────
    op.create_table(
        "policy_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("policy_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("content_format", sa.String(20), server_default="markdown"),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("authored_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("is_ai_drafted", sa.Boolean, server_default="false"),
        sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("approved_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("change_summary", sa.Text),
        sa.Column("rejection_reason", sa.Text),
        sa.Column("effective_from", sa.DateTime(timezone=True)),
        sa.Column("effective_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_policy_versions_tenant", "policy_versions", ["tenant_id"])
    op.create_index("ix_policy_versions_policy", "policy_versions", ["policy_id"])

    # ─── COMPANY INTEGRATIONS ─────────────────────────────────────────────────
    op.create_table(
        "company_integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("integration_type", sa.String(100), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="false"),
        sa.Column("is_verified", sa.Boolean, server_default="false"),
        sa.Column("credential_ref", sa.String(500)),
        sa.Column("config", postgresql.JSONB),
        sa.Column("last_verified_at", sa.DateTime(timezone=True)),
        sa.Column("verification_error", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_company_integrations_tenant", "company_integrations", ["tenant_id"])
    op.create_unique_constraint(
        "uq_integration_per_tenant", "company_integrations",
        ["tenant_id", "integration_type"]
    )

    # ─── SETUP WIZARD STATES ──────────────────────────────────────────────────
    op.create_table(
        "setup_wizard_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("step_company_profile", sa.Boolean, server_default="false"),
        sa.Column("step_offices", sa.Boolean, server_default="false"),
        sa.Column("step_departments", sa.Boolean, server_default="false"),
        sa.Column("step_hiring_rules", sa.Boolean, server_default="false"),
        sa.Column("step_compliance", sa.Boolean, server_default="false"),
        sa.Column("step_email_integration", sa.Boolean, server_default="false"),
        sa.Column("step_calendar_integration", sa.Boolean, server_default="false"),
        sa.Column("step_sandbox_test", sa.Boolean, server_default="false"),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("activated_at", sa.DateTime(timezone=True)),
        sa.Column("current_step", sa.Integer, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_setup_wizard_tenant", "setup_wizard_states", ["tenant_id"])
    op.create_unique_constraint(
        "uq_wizard_per_tenant", "setup_wizard_states", ["tenant_id"]
    )

    # Apply RLS to all new tenant-scoped tables
    conn = op.get_bind()
    for table in ["teams", "policy_documents", "policy_versions",
                  "company_integrations", "setup_wizard_states"]:
        _apply_rls(conn, table)


def downgrade() -> None:
    conn = op.get_bind()
    for table in ["teams", "policy_documents", "policy_versions",
                  "company_integrations", "setup_wizard_states"]:
        conn.execute(sa.text(f"DROP POLICY IF EXISTS tenant_isolation ON {table}"))
    op.drop_table("setup_wizard_states")
    op.drop_table("company_integrations")
    op.drop_table("policy_versions")
    op.drop_table("policy_documents")
    op.drop_table("teams")
