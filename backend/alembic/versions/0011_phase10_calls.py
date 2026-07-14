"""
Phase 10 Database Migration
Adds: recruiter_calls and call_messages tables.
Applies RLS on both tables.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0011_phase10_calls"
down_revision: Union[str, None] = "0010_phase9_hackathons"
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
    # 1. recruiter_calls table
    op.create_table(
        "recruiter_calls",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="DIALING"),
        sa.Column("call_duration", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("recording_url", sa.String(500), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_recruiter_calls_application_id", "recruiter_calls", ["application_id"])

    # 2. call_messages table
    op.create_table(
        "call_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("call_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender", sa.String(50), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["call_id"], ["recruiter_calls.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_call_messages_call_id", "call_messages", ["call_id"])

    # Apply RLS
    conn = op.get_bind()
    _apply_rls(conn, "recruiter_calls")
    _apply_rls(conn, "call_messages")


def downgrade() -> None:
    op.drop_table("call_messages")
    op.drop_table("recruiter_calls")
