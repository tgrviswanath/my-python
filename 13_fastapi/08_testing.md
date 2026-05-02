# FastAPI — Testing

## Setup

```bash
pip install pytest pytest-asyncio httpx anyio
```

```python
# pytest.ini or pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

## Test Client

```python
# tests/conftest.py
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from app.main import app
from app.database import Base, get_db
from app.models import user, post  # Import all models

# ── In-memory SQLite for tests ────────────────────────────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()  # Rollback after each test

@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    # Override DB dependency with test session
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()

# ── Test data factories ───────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    from app.models.user import User
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=pwd_context.hash("TestPass123!"),
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user

@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, test_user):
    response = await client.post("/api/v1/auth/token", data={
        "username": "test@example.com",
        "password": "TestPass123!"
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

---

## Route Tests

```python
# tests/test_users.py
import pytest
from httpx import AsyncClient

class TestCreateUser:
    async def test_create_user_success(self, client: AsyncClient):
        response = await client.post("/api/v1/users", json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "SecurePass123!"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "new@example.com"
        assert "password" not in data
        assert "hashed_password" not in data
        assert "id" in data

    async def test_create_user_duplicate_email(self, client: AsyncClient, test_user):
        response = await client.post("/api/v1/users", json={
            "username": "another",
            "email": "test@example.com",  # Already exists
            "password": "SecurePass123!"
        })
        assert response.status_code == 409
        assert "already registered" in response.json()["error"]["message"]

    async def test_create_user_invalid_email(self, client: AsyncClient):
        response = await client.post("/api/v1/users", json={
            "username": "user",
            "email": "not-an-email",
            "password": "SecurePass123!"
        })
        assert response.status_code == 422
        errors = response.json()["error"]["details"]
        assert any("email" in e["field"] for e in errors)

    async def test_create_user_weak_password(self, client: AsyncClient):
        response = await client.post("/api/v1/users", json={
            "username": "user",
            "email": "user@example.com",
            "password": "weak"
        })
        assert response.status_code == 422

class TestGetUser:
    async def test_get_user_success(self, client: AsyncClient, test_user, auth_headers):
        response = await client.get(
            f"/api/v1/users/{test_user.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["id"] == test_user.id

    async def test_get_user_not_found(self, client: AsyncClient, auth_headers):
        response = await client.get("/api/v1/users/99999", headers=auth_headers)
        assert response.status_code == 404

    async def test_get_user_unauthorized(self, client: AsyncClient, test_user):
        response = await client.get(f"/api/v1/users/{test_user.id}")
        assert response.status_code == 401

class TestUpdateUser:
    async def test_update_user_success(self, client: AsyncClient, test_user, auth_headers):
        response = await client.patch(
            f"/api/v1/users/{test_user.id}",
            json={"full_name": "Updated Name"},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["full_name"] == "Updated Name"

    async def test_update_user_partial(self, client: AsyncClient, test_user, auth_headers):
        # Only update one field — others unchanged
        response = await client.patch(
            f"/api/v1/users/{test_user.id}",
            json={"full_name": "New Name"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "New Name"
        assert data["email"] == test_user.email  # Unchanged

class TestDeleteUser:
    async def test_delete_user_success(self, client: AsyncClient, test_user, auth_headers):
        response = await client.delete(
            f"/api/v1/users/{test_user.id}",
            headers=auth_headers
        )
        assert response.status_code == 204

    async def test_delete_user_not_found(self, client: AsyncClient, auth_headers):
        response = await client.delete("/api/v1/users/99999", headers=auth_headers)
        assert response.status_code == 404
```

---

## Auth Tests

```python
# tests/test_auth.py
class TestLogin:
    async def test_login_success(self, client: AsyncClient, test_user):
        response = await client.post("/api/v1/auth/token", data={
            "username": "test@example.com",
            "password": "TestPass123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, test_user):
        response = await client.post("/api/v1/auth/token", data={
            "username": "test@example.com",
            "password": "WrongPassword!"
        })
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        response = await client.post("/api/v1/auth/token", data={
            "username": "nobody@example.com",
            "password": "SomePassword123!"
        })
        assert response.status_code == 401

    async def test_protected_route_with_valid_token(self, client: AsyncClient, auth_headers):
        response = await client.get("/api/v1/profile", headers=auth_headers)
        assert response.status_code == 200

    async def test_protected_route_with_invalid_token(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/profile",
            headers={"Authorization": "Bearer invalid.token.here"}
        )
        assert response.status_code == 401
```

---

## Service Unit Tests (No HTTP)

```python
# tests/test_user_service.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.user_service import UserService
from app.schemas.user import UserCreate

class TestUserService:
    @pytest.fixture
    def mock_repo(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_repo):
        svc = UserService.__new__(UserService)
        svc.repo = mock_repo
        return svc

    async def test_create_user_success(self, service, mock_repo):
        mock_repo.get_by_email.return_value = None  # Email not taken
        mock_repo.create.return_value = MagicMock(
            id=1, username="alice", email="alice@example.com",
            full_name=None, is_active=True
        )

        user_data = UserCreate(
            username="alice",
            email="alice@example.com",
            password="SecurePass123!"
        )
        result = await service.create(user_data)

        mock_repo.get_by_email.assert_called_once_with("alice@example.com")
        mock_repo.create.assert_called_once()
        assert result.username == "alice"

    async def test_create_user_duplicate_email(self, service, mock_repo):
        from fastapi import HTTPException
        mock_repo.get_by_email.return_value = MagicMock()  # Email exists

        with pytest.raises(HTTPException) as exc_info:
            await service.create(UserCreate(
                username="alice",
                email="alice@example.com",
                password="SecurePass123!"
            ))

        assert exc_info.value.status_code == 409
```

---

## Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html --cov-report=term-missing

# Run specific file
pytest tests/test_users.py -v

# Run specific test
pytest tests/test_users.py::TestCreateUser::test_create_user_success -v

# Run with output
pytest -s -v

# Run only failed tests
pytest --lf
```

---

## Interview Q&A

### Q1: How do you test FastAPI routes without a real database?
Use `app.dependency_overrides` to replace `get_db` with a function that yields a test session connected to an in-memory SQLite database. Use `httpx.AsyncClient` with `ASGITransport` to make requests directly to the ASGI app without starting a server. Roll back after each test to keep tests isolated.

### Q2: What is the difference between unit tests and integration tests in FastAPI?
**Unit tests**: Test a single function/class in isolation. Mock all dependencies. Fast. Example: testing `UserService.create()` with a mocked repository.
**Integration tests**: Test the full stack — HTTP request → route → service → DB → response. Use `AsyncClient` + test DB. Slower but more realistic. Example: `POST /users` creates a user in the test DB and returns 201.

### Q3: How do you test authenticated endpoints?
Create a test user fixture, call the login endpoint to get a real JWT token, then pass it as `Authorization: Bearer <token>` header. Or create an `auth_headers` fixture that does this automatically. For unit tests, you can also override the `get_current_user` dependency to return a mock user directly.

### Q4: What is `pytest_asyncio` and why is it needed?
FastAPI routes are async, so tests need to run in an async context. `pytest-asyncio` provides the `asyncio_mode = "auto"` setting that automatically runs async test functions in an event loop. Without it, async test functions would return coroutines instead of executing.
