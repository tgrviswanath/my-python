"""Pydantic models for the Task Manager API."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class Priority(str, Enum):
    LOW    = 'low'
    MEDIUM = 'medium'
    HIGH   = 'high'


class Status(str, Enum):
    TODO       = 'todo'
    IN_PROGRESS = 'in_progress'
    DONE       = 'done'


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description='Task title')
    description: Optional[str] = Field(None, max_length=2000)
    priority: Priority = Priority.MEDIUM
    status: Status = Status.TODO
    tags: list[str] = Field(default_factory=list)

    @field_validator('title')
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Title cannot be blank')
        return v.strip()

    @field_validator('tags')
    @classmethod
    def tags_lowercase(cls, v: list[str]) -> list[str]:
        return [tag.lower().strip() for tag in v if tag.strip()]


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    priority: Optional[Priority] = None
    status: Optional[Status] = None
    tags: Optional[list[str]] = None


class Task(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {'from_attributes': True}


class TaskList(BaseModel):
    tasks: list[Task]
    total: int
    page: int
    page_size: int


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
