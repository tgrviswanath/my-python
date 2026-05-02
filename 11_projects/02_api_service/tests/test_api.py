"""Tests for the Task Manager API."""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from main import app
from database import InMemoryDatabase


@pytest.fixture
def client():
    """Fresh client with empty database for each test."""
    from database import db
    db._tasks.clear()
    db._next_id = 1
    with TestClient(app) as c:
        yield c


class TestHealth:
    def test_health(self, client):
        r = client.get('/health')
        assert r.status_code == 200
        assert r.json()['status'] == 'ok'


class TestCreateTask:
    def test_create_basic(self, client):
        r = client.post('/tasks', json={'title': 'Test task'})
        assert r.status_code == 201
        data = r.json()
        assert data['title'] == 'Test task'
        assert data['status'] == 'todo'
        assert data['priority'] == 'medium'
        assert 'id' in data
        assert 'created_at' in data

    def test_create_full(self, client):
        r = client.post('/tasks', json={
            'title': 'Full task',
            'description': 'A detailed description',
            'priority': 'high',
            'status': 'in_progress',
            'tags': ['python', 'testing'],
        })
        assert r.status_code == 201
        data = r.json()
        assert data['priority'] == 'high'
        assert 'python' in data['tags']

    def test_create_blank_title(self, client):
        r = client.post('/tasks', json={'title': '   '})
        assert r.status_code == 422

    def test_create_empty_title(self, client):
        r = client.post('/tasks', json={'title': ''})
        assert r.status_code == 422

    def test_create_invalid_priority(self, client):
        r = client.post('/tasks', json={'title': 'Task', 'priority': 'urgent'})
        assert r.status_code == 422


class TestGetTask:
    def test_get_existing(self, client):
        created = client.post('/tasks', json={'title': 'My task'}).json()
        r = client.get(f'/tasks/{created["id"]}')
        assert r.status_code == 200
        assert r.json()['title'] == 'My task'

    def test_get_not_found(self, client):
        r = client.get('/tasks/9999')
        assert r.status_code == 404


class TestListTasks:
    def test_list_empty(self, client):
        r = client.get('/tasks')
        assert r.status_code == 200
        assert r.json()['total'] == 0

    def test_list_with_tasks(self, client):
        for i in range(5):
            client.post('/tasks', json={'title': f'Task {i}'})
        r = client.get('/tasks')
        assert r.json()['total'] == 5

    def test_filter_by_status(self, client):
        client.post('/tasks', json={'title': 'Todo task', 'status': 'todo'})
        client.post('/tasks', json={'title': 'Done task', 'status': 'done'})
        r = client.get('/tasks?status=done')
        data = r.json()
        assert data['total'] == 1
        assert data['tasks'][0]['status'] == 'done'

    def test_pagination(self, client):
        for i in range(10):
            client.post('/tasks', json={'title': f'Task {i}'})
        r = client.get('/tasks?page=1&page_size=3')
        data = r.json()
        assert len(data['tasks']) == 3
        assert data['total'] == 10


class TestUpdateTask:
    def test_update_title(self, client):
        created = client.post('/tasks', json={'title': 'Old title'}).json()
        r = client.patch(f'/tasks/{created["id"]}', json={'title': 'New title'})
        assert r.status_code == 200
        assert r.json()['title'] == 'New title'

    def test_update_status(self, client):
        created = client.post('/tasks', json={'title': 'Task'}).json()
        r = client.patch(f'/tasks/{created["id"]}', json={'status': 'done'})
        assert r.json()['status'] == 'done'

    def test_update_not_found(self, client):
        r = client.patch('/tasks/9999', json={'title': 'X'})
        assert r.status_code == 404


class TestDeleteTask:
    def test_delete_existing(self, client):
        created = client.post('/tasks', json={'title': 'To delete'}).json()
        r = client.delete(f'/tasks/{created["id"]}')
        assert r.status_code == 204
        assert client.get(f'/tasks/{created["id"]}').status_code == 404

    def test_delete_not_found(self, client):
        r = client.delete('/tasks/9999')
        assert r.status_code == 404


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
