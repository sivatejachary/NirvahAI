"""
Phase 9 Database Migration
Adds: hackathon_submissions and code_defenses tables.
Applies RLS on both tables.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0010_phase9_hackathons"
down_revision: Union[str, None] = "0009_phase8_interviews"
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
    # 1. hackathon_submissions table
    op.create_table(
        "hackathon_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("repo_url", sa.String(500), nullable=True),
        sa.Column("code_snapshot", sa.Text(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="SUBMITTED"),
        sa.Column("architecture_score", sa.Float(), nullable=True),
        sa.Column("test_pass_ratio", sa.Float(), nullable=True),
        sa.Column("evaluation_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_hackathon_submissions_application_id", "hackathon_submissions", ["application_id"])

    # 2. code_defenses table
    op.create_table(
        "code_defenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("submission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("defense_question", sa.Text(), nullable=False),
        sa.Column("candidate_explanation", sa.Text(), nullable=True),
        sa.Column("plagiarism_risk", sa.String(50), nullable=False, server_default="LOW"),
        sa.Column("defense_score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["submission_id"], ["hackathon_submissions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_code_defenses_submission_id", "code_defenses", ["submission_id"])

    # Apply RLS
    conn = op.get_bind()
    _apply_rls(conn, "hackathon_submissions")
    _apply_rls(conn, "code_defenses")


def downgrade() -> None:
    op.drop_table("code_defenses")
    op.drop_table("hackathon_submissions")
