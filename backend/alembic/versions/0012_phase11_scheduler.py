"""
Phase 11 Database Migration
Adds: interviewer_schedules and interview_bookings tables.
Applies RLS on both tables.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0012_phase11_scheduler"
down_revision: Union[str, None] = "0011_phase10_calls"
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
    # 1. interviewer_schedules table
    op.create_table(
        "interviewer_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("office_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("skills", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("available_slots", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["office_id"], ["company_offices.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_interviewer_schedules_user_id", "interviewer_schedules", ["user_id"])

    # 2. interview_bookings table
    op.create_table(
        "interview_bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("interviewer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("meeting_link", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["interviewer_id"], ["interviewer_schedules.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_interview_bookings_application_id", "interview_bookings", ["application_id"])

    # Apply RLS
    conn = op.get_bind()
    _apply_rls(conn, "interviewer_schedules")
    _apply_rls(conn, "interview_bookings")


def downgrade() -> None:
    op.drop_table("interview_bookings")
    op.drop_table("interviewer_schedules")
