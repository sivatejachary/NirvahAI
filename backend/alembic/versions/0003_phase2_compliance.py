"""
Phase 2 Database Migration
Adds: compliance_profiles, consent_records, accommodation_requests, privacy_requests
Applies RLS on all new tenant-scoped tables.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0003_phase2_compliance"
down_revision: Union[str, None] = "0002_phase1_company"
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
    # ─── COMPLIANCE PROFILES ──────────────────────────────────────────────────
    op.create_table(
        "compliance_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("jurisdictions", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("ai_risk_classification", sa.String(50), nullable=False, server_default="HIGH"),
        sa.Column("bias_audit_requirements", postgresql.JSONB, nullable=True, server_default="{}"),
        sa.Column("strict_consent_required", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )
    
    # ─── CONSENT RECORDS ──────────────────────────────────────────────────────
    op.create_table(
        "consent_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_stage", sa.String(50), nullable=False),
        sa.Column("consent_status", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("consent_method", sa.String(50), nullable=False, server_default="WEB_FORM"),
        sa.Column("verification_metadata", postgresql.JSONB, nullable=True, server_default="{}"),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_consent_records_candidate_id", "consent_records", ["candidate_id"])
    
    # ─── ACCOMMODATION REQUESTS ───────────────────────────────────────────────
    op.create_table(
        "accommodation_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_type", sa.String(50), nullable=False),
        sa.Column("details", sa.Text, nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("review_notes", sa.Text, nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_accommodation_requests_candidate_id", "accommodation_requests", ["candidate_id"])
    
    # ─── PRIVACY REQUESTS ─────────────────────────────────────────────────────
    op.create_table(
        "privacy_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_type", sa.String(50), nullable=False),
        sa.Column("candidate_email", sa.String(320), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("verification_token", sa.String(200), nullable=True),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("execution_log", postgresql.JSONB, nullable=True, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_privacy_requests_candidate_email", "privacy_requests", ["candidate_email"])
    
    # ─── Apply RLS ────────────────────────────────────────────────────────────
    conn = op.get_bind()
    _apply_rls(conn, "compliance_profiles")
    _apply_rls(conn, "consent_records")
    _apply_rls(conn, "accommodation_requests")
    _apply_rls(conn, "privacy_requests")


def downgrade() -> None:
    op.drop_table("privacy_requests")
    op.drop_table("accommodation_requests")
    op.drop_table("consent_records")
    op.drop_table("compliance_profiles")
