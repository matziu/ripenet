import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User


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
class TestSubnetInfoTool:
    def test_subnet_info(self, api_client):
        response = api_client.post("/api/v1/tools/subnet-info/", {"cidr": "10.0.1.0/24"})
        assert response.status_code == 200
        data = response.json()
        assert data["network"] == "10.0.1.0"
        assert data["broadcast"] == "10.0.1.255"
        assert data["netmask"] == "255.255.255.0"
        assert data["num_hosts"] == 254
        assert data["prefix_length"] == 24
        assert data["is_private"] is True

    def test_subnet_info_invalid(self, api_client):
        response = api_client.post("/api/v1/tools/subnet-info/", {"cidr": "invalid"})
        assert response.status_code == 400

    def test_subnet_info_missing(self, api_client):
        response = api_client.post("/api/v1/tools/subnet-info/", {})
        assert response.status_code == 400


@pytest.mark.django_db
class TestVLSMTool:
    def test_vlsm_partition(self, api_client):
        response = api_client.post("/api/v1/tools/vlsm/", {
            "cidr": "10.0.0.0/24",
            "requirements": [
                {"name": "LAN", "hosts": 100},
                {"name": "Servers", "hosts": 30},
                {"name": "Management", "hosts": 10},
            ],
        }, format="json")
        assert response.status_code == 200
        data = response.json()
        assert data["parent"] == "10.0.0.0/24"
        assert len(data["allocations"]) == 3
        # Largest first
        assert data["allocations"][0]["name"] == "LAN"
        assert data["allocations"][0]["subnet"] is not None
