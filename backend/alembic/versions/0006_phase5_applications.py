"""
Phase 5 Database Migration
Adds: applications table
Applies RLS on the applications table.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0006_phase5_applications"
down_revision: Union[str, None] = "0005_phase4_jobs"
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
    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_name", sa.String(255), nullable=False),
        sa.Column("candidate_email", sa.String(320), nullable=False),
        sa.Column("resume_url", sa.String(500), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="APPLIED"),
        sa.Column("raw_parsed_data", postgresql.JSONB, nullable=True, server_default="{}"),
        sa.Column("fit_score", sa.Float, nullable=True),
        sa.Column("screening_feedback", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_applications_job_id", "applications", ["job_id"])
    op.create_index("ix_applications_candidate_email", "applications", ["candidate_email"])
    
    # Apply RLS
    conn = op.get_bind()
    _apply_rls(conn, "applications")


def downgrade() -> None:
    op.drop_table("applications")
