import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.projects.models import Project


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin", password="testpass123", role=User.Role.ADMIN,
    )


@pytest.fixture
def api_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.mark.django_db
class TestProjectAPI:
    def test_create_project(self, api_client):
        response = api_client.post("/api/v1/projects/", {
            "name": "Test Investment",
            "description": "Test project",
            "status": "planning",
        })
        assert response.status_code == 201
        assert response.json()["name"] == "Test Investment"

    def test_list_projects(self, api_client):
        Project.objects.create(name="Project 1", created_by=User.objects.first())
        Project.objects.create(name="Project 2", created_by=User.objects.first())
        response = api_client.get("/api/v1/projects/")
        assert response.status_code == 200
        assert response.json()["count"] == 2

    def test_project_topology(self, api_client, admin_user):
        project = Project.objects.create(name="Topo Project", created_by=admin_user)
        response = api_client.get(f"/api/v1/projects/{project.id}/topology/")
        assert response.status_code == 200
        data = response.json()
        assert "sites" in data
        assert "tunnels" in data

    def test_unauthenticated_access(self):
        client = APIClient()
        response = client.get("/api/v1/projects/")
        assert response.status_code == 403
