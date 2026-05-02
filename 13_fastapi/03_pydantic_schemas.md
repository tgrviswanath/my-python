# FastAPI — Pydantic Models & Request/Response Schemas

## Pydantic v2 Basics

Pydantic validates data using Python type hints. FastAPI uses Pydantic for request body parsing, response serialization, and settings management.

```python
from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator
from typing import Optional
from datetime import datetime
from enum import Enum

class OrderStatus(str, Enum):
    pending   = "pending"
    confirmed = "confirmed"
    shipped   = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"

class ItemSchema(BaseModel):
    product_id: int
    name: str
    quantity: int = Field(ge=1, le=100, description="Must be between 1 and 100")
    price: float = Field(gt=0, description="Must be positive")

class OrderCreate(BaseModel):
    customer_id: int
    items: list[ItemSchema]
    notes: Optional[str] = Field(default=None, max_length=500)

    # Field-level validator
    @field_validator("items")
    @classmethod
    def items_not_empty(cls, v):
        if not v:
            raise ValueError("Order must have at least one item")
        return v

    # Model-level validator (access multiple fields)
    @model_validator(mode="after")
    def check_total(self):
        total = sum(i.price * i.quantity for i in self.items)
        if total > 10000:
            raise ValueError("Order total cannot exceed $10,000")
        return self

class OrderResponse(BaseModel):
    id: int
    customer_id: int
    items: list[ItemSchema]
    total: float
    status: OrderStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}  # Allows ORM model → Pydantic
```

---

## Request Body

```python
from fastapi import FastAPI, Body
from pydantic import BaseModel

app = FastAPI()

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=0, le=150)

@app.post("/users", response_model=UserResponse, status_code=201)
async def create_user(user: UserCreate):
    # user is already validated by Pydantic
    return await create_user_in_db(user)

# Multiple body parameters
class Item(BaseModel):
    name: str
    price: float

class User(BaseModel):
    username: str

@app.post("/order")
async def create_order(
    item: Item,
    user: User,
    importance: int = Body(default=1, ge=1, le=5)  # extra body field
):
    return {"item": item, "user": user, "importance": importance}
# Body: {"item": {"name": "...", "price": 9.99}, "user": {"username": "..."}, "importance": 3}
```

---

## Response Models

```python
from pydantic import BaseModel, computed_field

class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str                     # Only in request

class UserUpdate(BaseModel):
    full_name: Optional[str] = None   # All fields optional for PATCH
    email: Optional[EmailStr] = None

class UserInDB(UserBase):
    id: int
    hashed_password: str              # Never expose this
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    # hashed_password NOT included — security!

    @computed_field
    @property
    def display_name(self) -> str:
        return self.full_name or self.username

    model_config = {"from_attributes": True}

# response_model filters out fields not in UserResponse
@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int):
    user = await db.get_user(user_id)  # Returns UserInDB with hashed_password
    return user                         # FastAPI filters to UserResponse fields
```

---

## Nested Models & Complex Types

```python
from pydantic import BaseModel, HttpUrl
from typing import Union

class Address(BaseModel):
    street: str
    city: str
    country: str = "US"
    zip_code: str = Field(pattern=r"^\d{5}(-\d{4})?$")

class Profile(BaseModel):
    bio: Optional[str] = None
    avatar_url: Optional[HttpUrl] = None
    social_links: dict[str, HttpUrl] = {}

class UserFull(BaseModel):
    id: int
    username: str
    address: Optional[Address] = None
    profile: Profile = Profile()
    tags: list[str] = []
    metadata: dict[str, Union[str, int, bool]] = {}

# Nested validation works automatically
user = UserFull(
    id=1,
    username="alice",
    address={"street": "123 Main St", "city": "NYC", "zip_code": "10001"},
    profile={"bio": "Developer"},
    tags=["python", "fastapi"]
)
```

---

## Schema Inheritance Pattern

```python
# Base schema with shared fields
class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    price: float = Field(gt=0)
    category: str

# Create: all required fields
class ProductCreate(ProductBase):
    stock: int = Field(ge=0, default=0)

# Update: all optional (PATCH semantics)
class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, gt=0)
    category: Optional[str] = None
    stock: Optional[int] = Field(default=None, ge=0)

# Response: includes DB-generated fields
class ProductResponse(ProductBase):
    id: int
    stock: int
    created_at: datetime
    updated_at: datetime
    is_active: bool = True

    model_config = {"from_attributes": True}

# List response with pagination
class PaginatedResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    size: int
    pages: int
```

---

## Custom Validators

```python
from pydantic import field_validator, model_validator
import re

class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain a digit")
        if not re.search(r"[!@#$%^&*]", v):
            raise ValueError("Password must contain a special character")
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        if self.new_password == self.current_password:
            raise ValueError("New password must differ from current password")
        return self
```

---

## Handling Validation Errors

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

app = FastAPI()

# FastAPI automatically returns 422 for validation errors
# Response format:
# {
#   "detail": [
#     {
#       "type": "missing",
#       "loc": ["body", "email"],
#       "msg": "Field required",
#       "input": {...}
#     }
#   ]
# }

# Custom error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc):
    errors = []
    for error in exc.errors():
        errors.append({
            "field": " → ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    return JSONResponse(
        status_code=422,
        content={"errors": errors}
    )
```

---

## Interview Q&A

### Q1: What is Pydantic and why does FastAPI use it?
Pydantic is a data validation library that uses Python type hints. FastAPI uses it to: (1) automatically validate request bodies, (2) serialize response data, (3) generate OpenAPI schema for documentation. When validation fails, FastAPI returns a 422 with detailed error messages automatically — no manual validation code needed.

### Q2: What is the difference between `UserCreate`, `UserResponse`, and `UserInDB`?
This is the schema separation pattern: **UserCreate** — fields needed to create a user (includes password). **UserResponse** — fields safe to return to clients (excludes hashed_password). **UserInDB** — all fields including DB-generated ones (id, timestamps, hashed_password). Using `response_model=UserResponse` ensures sensitive fields are never accidentally exposed.

### Q3: How does `from_attributes = True` work?
It allows Pydantic to read data from ORM model attributes (like SQLAlchemy objects) instead of only from dicts. Without it, `UserResponse.model_validate(orm_user)` would fail because SQLAlchemy objects aren't dicts. With it, Pydantic accesses attributes directly: `orm_user.id`, `orm_user.username`, etc.

### Q4: What is the difference between `field_validator` and `model_validator`?
**`field_validator`**: Validates a single field. Runs before the model is fully constructed. Use for field-specific rules (password strength, format checks).
**`model_validator`**: Validates the entire model after all fields are set. Can access multiple fields. Use for cross-field validation (passwords match, date range valid).
