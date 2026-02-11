import ipaddress

import pytest
from django.core.exceptions import ValidationError

from apps.ipam.validators import check_ip_in_subnet


class TestCheckIpInSubnet:
    def test_valid_ip_in_subnet(self):
        """IP within subnet should not raise."""
        check_ip_in_subnet("10.0.1.5", "10.0.1.0/24")

    def test_ip_outside_subnet(self):
        """IP outside subnet should raise ValidationError."""
        with pytest.raises(ValidationError):
            check_ip_in_subnet("10.0.2.5", "10.0.1.0/24")

    def test_network_address(self):
        """Network address is technically in the subnet."""
        check_ip_in_subnet("10.0.1.0", "10.0.1.0/24")

    def test_broadcast_address(self):
        """Broadcast address is technically in the subnet."""
        check_ip_in_subnet("10.0.1.255", "10.0.1.0/24")
