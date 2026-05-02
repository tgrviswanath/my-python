# FastAPI — Database Integration with SQLAlchemy (Async)

## Setup: Async SQLAlchemy + PostgreSQL

```bash
pip install sqlalchemy asyncpg alembic psycopg2-binary
```

```python
# app/database.py
from sqlalchemy.ext.asyncio import (
    AsyncSession, create_async_engine, async_sessionmaker
)
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,          # postgresql+asyncpg://user:pass@host/db
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,             # Verify connections before use
    echo=settings.debug
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False          # Don't expire objects after commit
)

class Base(DeclarativeBase):
    pass
```

---

## ORM Models

```python
# app/models/user.py
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True, index=True)
    username:   Mapped[str]      = mapped_column(String(50), unique=True, index=True, nullable=False)
    email:      Mapped[str]      = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name:  Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active:  Mapped[bool]     = mapped_column(Boolean, default=True)
    is_admin:   Mapped[bool]     = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    posts: Mapped[list["Post"]] = relationship("Post", back_populates="author", lazy="selectin")

class Post(Base):
    __tablename__ = "posts"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True, index=True)
    title:      Mapped[str]      = mapped_column(String(200), nullable=False)
    content:    Mapped[str]      = mapped_column(Text, nullable=False)
    author_id:  Mapped[int]      = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    is_published: Mapped[bool]   = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    author: Mapped["User"] = relationship("User", back_populates="posts")
```

---

## Repository Pattern

```python
# app/repositories/user_repo.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import selectinload
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from typing import Optional

class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 20) -> list[User]:
        result = await self.db.execute(
            select(User)
            .offset(skip)
            .limit(limit)
            .order_by(User.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_with_posts(self, user_id: int) -> Optional[User]:
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.posts))  # Eager load posts
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def count(self) -> int:
        result = await self.db.execute(select(func.count(User.id)))
        return result.scalar_one()

    async def create(self, user_data: UserCreate, hashed_password: str) -> User:
        user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name
        )
        self.db.add(user)
        await self.db.flush()   # Get ID without committing
        await self.db.refresh(user)
        return user

    async def update(self, user_id: int, user_data: UserUpdate) -> Optional[User]:
        update_data = user_data.model_dump(exclude_unset=True)  # Only set fields
        if not update_data:
            return await self.get_by_id(user_id)

        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(**update_data)
        )
        return await self.get_by_id(user_id)

    async def delete(self, user_id: int) -> bool:
        result = await self.db.execute(
            delete(User).where(User.id == user_id)
        )
        return result.rowcount > 0

    async def search(self, query: str, skip: int = 0, limit: int = 20) -> list[User]:
        result = await self.db.execute(
            select(User)
            .where(
                User.username.ilike(f"%{query}%") |
                User.email.ilike(f"%{query}%") |
                User.full_name.ilike(f"%{query}%")
            )
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
```

---

## Service Layer

```python
# app/services/user_service.py
from fastapi import HTTPException, status
from passlib.context import CryptContext
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from sqlalchemy.ext.asyncio import AsyncSession

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserService:
    def __init__(self, db: AsyncSession):
        self.repo = UserRepository(db)

    async def create(self, user_data: UserCreate) -> UserResponse:
        # Check uniqueness
        if await self.repo.get_by_email(user_data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )

        hashed = pwd_context.hash(user_data.password)
        user = await self.repo.create(user_data, hashed)
        return UserResponse.model_validate(user)

    async def get_by_id(self, user_id: int) -> UserResponse:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse.model_validate(user)

    async def get_all(self, skip: int, limit: int) -> list[UserResponse]:
        users = await self.repo.get_all(skip=skip, limit=limit)
        return [UserResponse.model_validate(u) for u in users]

    async def update(self, user_id: int, data: UserUpdate) -> UserResponse:
        user = await self.repo.update(user_id, data)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse.model_validate(user)

    async def delete(self, user_id: int) -> None:
        deleted = await self.repo.delete(user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="User not found")

    def verify_password(self, plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)
```

---

## Alembic Migrations

```bash
# Initialize Alembic
alembic init alembic

# alembic/env.py — configure to use your models
# from app.database import Base
# from app.models import user, post  # Import all models
# target_metadata = Base.metadata

# Create migration
alembic revision --autogenerate -m "create users table"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1

# Show history
alembic history

# Show current version
alembic current
```

```python
# alembic/versions/001_create_users.py
def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("username")
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_username", "users", ["username"])

def downgrade() -> None:
    op.drop_table("users")
```

---

## Interview Q&A

### Q1: What is the Repository pattern and why use it?
Repository pattern separates data access logic from business logic. The repository handles all DB queries; the service handles business rules. Benefits: (1) Testable — mock the repository in service tests, (2) Swappable — change DB without touching business logic, (3) Single responsibility — each layer has one job.

### Q2: What is `expire_on_commit=False` and why set it?
By default, SQLAlchemy expires all ORM objects after `commit()`, requiring a new DB query to access their attributes. In async FastAPI, this causes `MissingGreenlet` errors when accessing attributes after commit. Setting `expire_on_commit=False` keeps the data in memory after commit, avoiding extra queries.

### Q3: What is the difference between `flush()` and `commit()`?
**`flush()`**: Sends SQL to the DB within the current transaction but doesn't commit. The DB sees the changes but they're not permanent. Use to get auto-generated IDs before committing.
**`commit()`**: Makes changes permanent. After commit, the transaction ends.
In FastAPI with `yield` dependencies, commit happens automatically at the end of the request.

### Q4: How do you handle N+1 query problems in SQLAlchemy?
N+1 problem: loading 10 users then querying posts for each = 11 queries. Solutions: (1) `selectinload` — loads related objects in a second query (2 queries total), (2) `joinedload` — loads with JOIN (1 query, but can be large), (3) `lazy="selectin"` on relationship — automatic selectin loading. Always check query count with `echo=True` in development.
