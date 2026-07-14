"""
Phase 7 Database Migration
Adds: coding_challenges and coding_submissions tables.
Applies RLS on both tables.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0008_phase7_challenges"
down_revision: Union[str, None] = "0007_phase6_assessments"
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
    # 1. coding_challenges table
    op.create_table(
        "coding_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("starter_code", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("test_cases", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_coding_challenges_job_id", "coding_challenges", ["job_id"])

    # 2. coding_submissions table
    op.create_table(
        "coding_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assessment_attempt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("challenge_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("language", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="PENDING"),
        sa.Column("results", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assessment_attempt_id"], ["assessment_attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["challenge_id"], ["coding_challenges.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_coding_submissions_challenge_id", "coding_submissions", ["challenge_id"])

    # Apply RLS
    conn = op.get_bind()
    _apply_rls(conn, "coding_challenges")
    _apply_rls(conn, "coding_submissions")


def downgrade() -> None:
    op.drop_table("coding_submissions")
    op.drop_table("coding_challenges")
