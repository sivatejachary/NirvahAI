"""
Phase 3 Database Migration
Adds: ai_usage_logs, workflow_instances
Applies RLS on all new tenant-scoped tables.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0004_phase3_workflows"
down_revision: Union[str, None] = "0003_phase2_compliance"
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
    # ─── AI USAGE LOGS ────────────────────────────────────────────────────────
    op.create_table(
        "ai_usage_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_name", sa.String(100), nullable=False),
        sa.Column("purpose", sa.String(100), nullable=False),
        sa.Column("prompt_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ai_usage_logs_created_at", "ai_usage_logs", ["created_at"])
    
    # ─── WORKFLOW INSTANCES ───────────────────────────────────────────────────
    op.create_table(
        "workflow_instances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("current_stage", sa.String(50), nullable=False, server_default="MCQ"),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("state_data", postgresql.JSONB, nullable=True, server_default="{}"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_workflow_instances_application_id", "workflow_instances", ["application_id"])
    
    # ─── Apply RLS ────────────────────────────────────────────────────────────
    conn = op.get_bind()
    _apply_rls(conn, "ai_usage_logs")
    _apply_rls(conn, "workflow_instances")


def downgrade() -> None:
    op.drop_table("workflow_instances")
    op.drop_table("ai_usage_logs")
