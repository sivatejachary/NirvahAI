"""
Phase 6 Database Migration
Adds: job_mcqs, assessment_attempts, and proctoring_logs tables.
Applies RLS on all three tables.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0007_phase6_assessments"
down_revision: Union[str, None] = "0006_phase5_applications"
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
    # 1. job_mcqs table
    op.create_table(
        "job_mcqs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("options", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("correct_option", sa.String(255), nullable=False),
        sa.Column("difficulty", sa.String(50), nullable=False, server_default="MID"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_job_mcqs_job_id", "job_mcqs", ["job_id"])

    # 2. assessment_attempts table
    op.create_table(
        "assessment_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(50), nullable=False, server_default="MCQ"),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="STARTED"),
        sa.Column("integrity_risk", sa.String(50), nullable=False, server_default="LOW"),
        sa.Column("responses", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_assessment_attempts_application_id", "assessment_attempts", ["application_id"])

    # 3. proctoring_logs table
    op.create_table(
        "proctoring_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assessment_attempt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("evidence_reference", sa.String(500), nullable=True),
        sa.Column("log_metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assessment_attempt_id"], ["assessment_attempts.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_proctoring_logs_assessment_attempt_id", "proctoring_logs", ["assessment_attempt_id"])

    # Apply RLS
    conn = op.get_bind()
    _apply_rls(conn, "job_mcqs")
    _apply_rls(conn, "assessment_attempts")
    _apply_rls(conn, "proctoring_logs")


def downgrade() -> None:
    op.drop_table("proctoring_logs")
    op.drop_table("assessment_attempts")
    op.drop_table("job_mcqs")
