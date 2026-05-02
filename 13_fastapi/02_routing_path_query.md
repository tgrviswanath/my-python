# FastAPI — Routing, Path & Query Parameters

## HTTP Methods & Routes

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/items")          # GET
@app.post("/items")         # POST
@app.put("/items/{id}")     # PUT (full update)
@app.patch("/items/{id}")   # PATCH (partial update)
@app.delete("/items/{id}")  # DELETE
@app.head("/items")         # HEAD
@app.options("/items")      # OPTIONS
```

---

## Path Parameters

```python
from fastapi import FastAPI, Path
from enum import Enum

app = FastAPI()

# Basic path parameter
@app.get("/users/{user_id}")
def get_user(user_id: int):          # Auto-converts str → int, validates
    return {"user_id": user_id}

# With validation using Path()
@app.get("/items/{item_id}")
def get_item(
    item_id: int = Path(
        ...,                          # ... means required
        title="Item ID",
        description="The ID of the item",
        ge=1,                         # greater than or equal to 1
        le=1000                       # less than or equal to 1000
    )
):
    return {"item_id": item_id}

# String path parameter
@app.get("/files/{file_path:path}")   # :path matches slashes too
def get_file(file_path: str):
    return {"file_path": file_path}
# GET /files/home/user/docs/file.txt → file_path = "home/user/docs/file.txt"

# Enum path parameter
class ModelName(str, Enum):
    alexnet = "alexnet"
    resnet  = "resnet"
    lenet   = "lenet"

@app.get("/models/{model_name}")
def get_model(model_name: ModelName):
    if model_name == ModelName.alexnet:
        return {"model": model_name, "message": "Deep Learning FTW!"}
    return {"model": model_name}
```

---

## Query Parameters

```python
from fastapi import FastAPI, Query
from typing import Optional

app = FastAPI()

# Basic query parameters
@app.get("/items")
def list_items(
    skip: int = 0,                    # default = 0
    limit: int = 10,                  # default = 10
    search: Optional[str] = None      # optional, default = None
):
    return {"skip": skip, "limit": limit, "search": search}
# GET /items?skip=20&limit=5&search=laptop

# With validation using Query()
@app.get("/products")
def list_products(
    q: Optional[str] = Query(
        default=None,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9 ]+$",
        title="Search query",
        description="Search products by name"
    ),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100)
):
    return {"q": q, "page": page, "size": size}

# Required query parameter (no default)
@app.get("/search")
def search(q: str):                   # required — no default
    return {"query": q}

# List query parameter
@app.get("/filter")
def filter_items(
    tags: list[str] = Query(default=[])
):
    return {"tags": tags}
# GET /filter?tags=python&tags=fastapi → tags = ["python", "fastapi"]

# Alias (when param name conflicts with Python keywords)
@app.get("/legacy")
def legacy_endpoint(
    item_query: Optional[str] = Query(default=None, alias="item-query")
):
    return {"item_query": item_query}
# GET /legacy?item-query=foo
```

---

## APIRouter — Organizing Routes

```python
# app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.user_service import UserService
from app.dependencies import get_db, get_current_user

router = APIRouter(
    prefix="/users",
    tags=["users"],                   # Groups in Swagger UI
    responses={
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"}
    }
)

@router.get("/", response_model=list[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 20,
    db = Depends(get_db)
):
    return await UserService(db).get_all(skip=skip, limit=limit)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db = Depends(get_db)):
    user = await UserService(db).get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user_in: UserCreate, db = Depends(get_db)):
    return await UserService(db).create(user_in)

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await UserService(db).update(user_id, user_in)

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db = Depends(get_db),
    current_user = Depends(get_current_user)
):
    await UserService(db).delete(user_id)

# app/main.py
from app.routers import users, items, auth

app.include_router(auth.router,  prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(items.router, prefix="/api/v1")
```

---

## Route Order Matters

```python
# IMPORTANT: FastAPI matches routes in order of definition

@app.get("/users/me")          # ✅ Must be BEFORE /users/{user_id}
def get_current_user_route():
    return {"user": "current"}

@app.get("/users/{user_id}")   # Would match "me" as user_id if defined first
def get_user(user_id: str):
    return {"user_id": user_id}
```

---

## Response Status Codes

```python
from fastapi import status

@app.post("/items", status_code=status.HTTP_201_CREATED)
def create_item(): ...

@app.delete("/items/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(id: int): ...

# Dynamic status code
from fastapi import Response

@app.get("/items/{id}")
def get_item(id: int, response: Response):
    item = db.get(id)
    if not item:
        response.status_code = status.HTTP_404_NOT_FOUND
        return {"error": "not found"}
    return item
```

---

## Interview Q&A

### Q1: What is the difference between path and query parameters?
**Path parameters**: Part of the URL path (`/users/{user_id}`). Required. Used to identify a specific resource.
**Query parameters**: After `?` in the URL (`/items?skip=0&limit=10`). Optional (can have defaults). Used for filtering, pagination, sorting.

### Q2: How does FastAPI validate path/query parameters automatically?
FastAPI uses Python type hints. When you declare `user_id: int`, FastAPI automatically: (1) extracts the value from the URL, (2) converts it to `int`, (3) validates it (returns 422 if not a valid int), (4) passes it to your function. Use `Path()` and `Query()` for additional constraints like `ge`, `le`, `min_length`.

### Q3: What HTTP status code should you return for each operation?
- `GET` (found): 200 OK
- `POST` (created): 201 Created
- `PUT`/`PATCH` (updated): 200 OK
- `DELETE` (deleted): 204 No Content
- Not found: 404 Not Found
- Validation error: 422 Unprocessable Entity (FastAPI does this automatically)
- Unauthorized: 401 Unauthorized
- Forbidden: 403 Forbidden

### Q4: How do you handle optional vs required parameters?
**Required**: No default value — `def f(q: str)` or `q: str = Query(...)`.
**Optional**: Has a default — `def f(q: str = None)` or `q: Optional[str] = Query(default=None)`.
**With validation**: `q: str = Query(default=None, min_length=3)`.
