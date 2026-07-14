"""
User, Role, Permission, and RBAC Models
Multi-tenant user management with role-based access control.
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, Table, Column, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


# ── Association Tables ────────────────────────────────────────────────────────
user_roles_table = Table(
    "user_roles",
    Base.metadata,
    Column(
        "user_id",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "role_id",
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

role_permissions_table = Table(
    "role_permissions",
    Base.metadata,
    Column(
        "role_id",
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "permission_id",
        UUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Permission(Base, TimestampMixin):
    """
    Fine-grained permission definition.
    Format: resource:action  e.g.  candidates:read, jobs:create
    """
    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    resource: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)

    roles: Mapped[list["Role"]] = relationship(
        secondary=role_permissions_table, back_populates="permissions"
    )

    def __repr__(self) -> str:
        return f"<Permission {self.name}>"


class Role(Base, TimestampMixin):
    """
    RBAC Role definition. Roles are platform-level (system) or tenant-level.
    System roles: platform_admin, tenant_admin
    Tenant roles: hr_manager, hr_recruiter, hiring_manager, interviewer, employee, candidate
    """
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=False)

    permissions: Mapped[list["Permission"]] = relationship(
        secondary=role_permissions_table, back_populates="roles"
    )
    users: Mapped[list["User"]] = relationship(
        secondary=user_roles_table, back_populates="roles"
    )

    def __repr__(self) -> str:
        return f"<Role {self.name}>"


class User(Base, TenantMixin, TimestampMixin):
    """
    Platform user (HR staff, hiring manager, interviewer, employee, platform admin).
    Candidates have their own separate table.
    """
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    # tenant_id inherited from TenantMixin
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(1024), nullable=False)
    full_name: Mapped[str] = mapped_column(String(500), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50))

    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="active"
    )
    # active | inactive | locked | invited | mfa_pending

    is_platform_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_secret: Mapped[Optional[str]] = mapped_column(String(500))

    last_login_at: Mapped[Optional[str]] = mapped_column()
    failed_login_attempts: Mapped[int] = mapped_column(default=0)

    roles: Mapped[list["Role"]] = relationship(
        secondary=user_roles_table, back_populates="users"
    )
    tenant: Mapped["Tenant"] = relationship(back_populates="users")

    @property
    def role_names(self) -> list[str]:
        return [role.name for role in self.roles]

    @property
    def permission_names(self) -> list[str]:
        perms = set()
        for role in self.roles:
            for perm in role.permissions:
                perms.add(perm.name)
        return list(perms)

    def has_permission(self, permission: str) -> bool:
        if self.is_platform_admin:
            return True
        return permission in self.permission_names

    def __repr__(self) -> str:
        return f"<User {self.email} tenant={self.tenant_id}>"


class RefreshToken(Base, TimestampMixin):
    """Stored refresh tokens for rotation and revocation."""
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True)
    expires_at: Mapped[str] = mapped_column(nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    revoked_at: Mapped[Optional[str]] = mapped_column()


from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.tenant import Tenant
