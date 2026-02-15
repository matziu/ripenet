import ipaddress

from django.core.exceptions import ValidationError

from .models import Host, Subnet, Tunnel


def check_subnet_overlap(network, project, exclude_pk=None):
    """Check if a subnet overlaps with any existing subnet in the same project."""
    existing = Subnet.objects.filter(
        project=project
    ).exclude(pk=exclude_pk)

    net = ipaddress.ip_network(str(network), strict=False)

    for subnet in existing:
        existing_net = ipaddress.ip_network(str(subnet.network), strict=False)
        if net.overlaps(existing_net):
            if subnet.vlan:
                location = f"{subnet.site.name} / {subnet.vlan.name}"
            else:
                location = f"{subnet.site.name} (standalone)"
            raise ValidationError(
                f"Subnet {network} overlaps with existing subnet {subnet.network} "
                f"in {location}"
            )


def check_ip_duplicate_in_project(ip_address, project, exclude_pk=None):
    """Check if an IP address is already used in the same project (hosts + tunnel endpoints)."""
    ip_str = str(ip_address)

    # Check hosts
    hosts_qs = Host.objects.filter(
        subnet__project=project,
        ip_address=ip_str,
    ).exclude(pk=exclude_pk)

    if hosts_qs.exists():
        host = hosts_qs.first()
        location = host.subnet.site.name
        raise ValidationError(
            f"IP {ip_address} is already assigned to host {host.hostname or host.ip_address} "
            f"in {location}"
        )

    # Check tunnel endpoints
    tunnel_qs = Tunnel.objects.filter(project=project).filter(
        models_Q_ip_a_or_b(ip_str)
    )

    if tunnel_qs.exists():
        tunnel = tunnel_qs.first()
        raise ValidationError(
            f"IP {ip_address} is already used in tunnel {tunnel.name}"
        )


def models_Q_ip_a_or_b(ip_str):
    from django.db.models import Q
    return Q(ip_a=ip_str) | Q(ip_b=ip_str)


def check_ip_in_subnet(ip_address, subnet_network):
    """Validate that an IP address belongs to the given subnet."""
    ip_str = str(ip_address).split("/")[0]  # Strip /32 prefix if present
    ip = ipaddress.ip_address(ip_str)
    net = ipaddress.ip_network(str(subnet_network), strict=False)
    if ip not in net:
        raise ValidationError(
            f"IP {ip_address} is not within subnet {subnet_network}"
        )
