"""Seed data for development. Run via: python manage.py shell < seed_data.py"""
from django.contrib.auth import get_user_model
from apps.projects.models import Project, Site
from apps.ipam.models import VLAN, Subnet, Host, Tunnel

User = get_user_model()
admin = User.objects.filter(username="admin").first()
if not admin:
    print("No admin user found, skipping seed")
    exit()

if Project.objects.exists():
    print("Data already exists, skipping seed")
    exit()

print("Creating seed data...")

# === Project 1: Inwestycja Kraków ===
p1 = Project.objects.create(
    name="Inwestycja Kraków",
    description="Sieć biurowa Kraków — 3 lokalizacje, tunele GRE",
    supernet="10.0.0.0/16",
    created_by=admin,
)

# Sites
hq = Site.objects.create(project=p1, name="HQ Kraków", address="ul. Floriańska 10, 31-019 Kraków",
                         latitude=50.064650, longitude=19.944980)
dc = Site.objects.create(project=p1, name="DC Kraków", address="ul. Mogilska 43, 31-545 Kraków",
                         latitude=50.068920, longitude=19.968130)
br = Site.objects.create(project=p1, name="Branch Nowa Huta", address="os. Centrum A 1, 31-929 Kraków",
                         latitude=50.072300, longitude=20.037600)

# --- HQ VLANs ---
vlan_mgmt = VLAN.objects.create(site=hq, vlan_id=10, name="Management", purpose="Zarządzanie urządzeniami")
vlan_users = VLAN.objects.create(site=hq, vlan_id=20, name="Users", purpose="Stacje robocze")
vlan_voip = VLAN.objects.create(site=hq, vlan_id=30, name="VoIP", purpose="Telefonia IP")
vlan_guest = VLAN.objects.create(site=hq, vlan_id=99, name="Guest", purpose="Sieć gościnna")

# HQ Subnets
s_mgmt = Subnet.objects.create(vlan=vlan_mgmt, network="10.0.10.0/24", gateway="10.0.10.1", description="Management HQ")
s_users = Subnet.objects.create(vlan=vlan_users, network="10.0.20.0/24", gateway="10.0.20.1", description="Users HQ")
s_voip = Subnet.objects.create(vlan=vlan_voip, network="10.0.30.0/24", gateway="10.0.30.1", description="VoIP HQ")
s_guest = Subnet.objects.create(vlan=vlan_guest, network="10.0.99.0/24", gateway="10.0.99.1", description="Guest HQ")

# HQ Hosts — Management
Host.objects.create(subnet=s_mgmt, ip_address="10.0.10.1", hostname="hq-core-sw01", device_type="switch", description="Core switch HP Aruba 5412R")
Host.objects.create(subnet=s_mgmt, ip_address="10.0.10.2", hostname="hq-fw01", device_type="firewall", description="FortiGate 200F")
Host.objects.create(subnet=s_mgmt, ip_address="10.0.10.3", hostname="hq-ap01", device_type="ap", description="Ubiquiti U6 Pro — piętro 1")
Host.objects.create(subnet=s_mgmt, ip_address="10.0.10.4", hostname="hq-ap02", device_type="ap", description="Ubiquiti U6 Pro — piętro 2")
Host.objects.create(subnet=s_mgmt, ip_address="10.0.10.5", hostname="hq-ap03", device_type="ap", description="Ubiquiti U6 Pro — piętro 3")

# HQ Hosts — Users
Host.objects.create(subnet=s_users, ip_address="10.0.20.10", hostname="hq-pc-kowalski", device_type="workstation")
Host.objects.create(subnet=s_users, ip_address="10.0.20.11", hostname="hq-pc-nowak", device_type="workstation")
Host.objects.create(subnet=s_users, ip_address="10.0.20.12", hostname="hq-printer01", device_type="printer", description="HP LaserJet Pro M428")
Host.objects.create(subnet=s_users, ip_address="10.0.20.100", hostname="", device_type="workstation", description="Pula DHCP start")

# HQ Hosts — VoIP
Host.objects.create(subnet=s_voip, ip_address="10.0.30.10", hostname="hq-phone-reception", device_type="phone", description="Yealink T46U")
Host.objects.create(subnet=s_voip, ip_address="10.0.30.11", hostname="hq-phone-director", device_type="phone", description="Yealink T58W")

# --- DC VLANs ---
vlan_dc_mgmt = VLAN.objects.create(site=dc, vlan_id=10, name="Management", purpose="Zarządzanie urządzeniami DC")
vlan_servers = VLAN.objects.create(site=dc, vlan_id=100, name="Servers", purpose="Serwery produkcyjne")
vlan_storage = VLAN.objects.create(site=dc, vlan_id=110, name="Storage", purpose="Sieć storage iSCSI")
vlan_dmz = VLAN.objects.create(site=dc, vlan_id=200, name="DMZ", purpose="Strefa zdemilitaryzowana")

# DC Subnets
s_dc_mgmt = Subnet.objects.create(vlan=vlan_dc_mgmt, network="10.1.10.0/24", gateway="10.1.10.1", description="Management DC")
s_servers = Subnet.objects.create(vlan=vlan_servers, network="10.1.100.0/24", gateway="10.1.100.1", description="Serwery produkcyjne")
s_storage = Subnet.objects.create(vlan=vlan_storage, network="10.1.110.0/24", gateway="10.1.110.1", description="iSCSI storage")
s_dmz = Subnet.objects.create(vlan=vlan_dmz, network="10.1.200.0/24", gateway="10.1.200.1", description="DMZ")

# DC Hosts — Management
Host.objects.create(subnet=s_dc_mgmt, ip_address="10.1.10.1", hostname="dc-core-sw01", device_type="switch", description="Cisco Nexus 9336C")
Host.objects.create(subnet=s_dc_mgmt, ip_address="10.1.10.2", hostname="dc-fw01", device_type="firewall", description="Palo Alto PA-820")
Host.objects.create(subnet=s_dc_mgmt, ip_address="10.1.10.3", hostname="dc-router01", device_type="router", description="Cisco ISR 4331")

# DC Hosts — Servers
Host.objects.create(subnet=s_servers, ip_address="10.1.100.10", hostname="dc-web01", device_type="server", description="Nginx reverse proxy")
Host.objects.create(subnet=s_servers, ip_address="10.1.100.11", hostname="dc-app01", device_type="server", description="Django app server")
Host.objects.create(subnet=s_servers, ip_address="10.1.100.12", hostname="dc-db01", device_type="server", description="PostgreSQL primary")
Host.objects.create(subnet=s_servers, ip_address="10.1.100.13", hostname="dc-db02", device_type="server", description="PostgreSQL replica")
Host.objects.create(subnet=s_servers, ip_address="10.1.100.20", hostname="dc-monitor01", device_type="server", description="Zabbix + Grafana")
Host.objects.create(subnet=s_servers, ip_address="10.1.100.21", hostname="dc-log01", device_type="server", description="ELK stack")

# DC Hosts — DMZ
Host.objects.create(subnet=s_dmz, ip_address="10.1.200.10", hostname="dc-mail01", device_type="server", description="Mail gateway")
Host.objects.create(subnet=s_dmz, ip_address="10.1.200.11", hostname="dc-vpn01", device_type="server", description="OpenVPN server")

# --- Branch Nowa Huta VLANs ---
vlan_br_mgmt = VLAN.objects.create(site=br, vlan_id=10, name="Management", purpose="Zarządzanie")
vlan_br_users = VLAN.objects.create(site=br, vlan_id=20, name="Users", purpose="Stacje robocze oddział")
vlan_br_cam = VLAN.objects.create(site=br, vlan_id=50, name="CCTV", purpose="Monitoring wizyjny")

# Branch Subnets
s_br_mgmt = Subnet.objects.create(vlan=vlan_br_mgmt, network="10.2.10.0/24", gateway="10.2.10.1", description="Management Branch")
s_br_users = Subnet.objects.create(vlan=vlan_br_users, network="10.2.20.0/24", gateway="10.2.20.1", description="Users Branch")
s_br_cam = Subnet.objects.create(vlan=vlan_br_cam, network="10.2.50.0/24", gateway="10.2.50.1", description="CCTV Branch")

# Branch Hosts
Host.objects.create(subnet=s_br_mgmt, ip_address="10.2.10.1", hostname="br-sw01", device_type="switch", description="HP Aruba 2930F")
Host.objects.create(subnet=s_br_mgmt, ip_address="10.2.10.2", hostname="br-router01", device_type="router", description="MikroTik RB4011")
Host.objects.create(subnet=s_br_users, ip_address="10.2.20.10", hostname="br-pc-jankowski", device_type="workstation")
Host.objects.create(subnet=s_br_users, ip_address="10.2.20.11", hostname="br-pc-wisniewski", device_type="workstation")
Host.objects.create(subnet=s_br_cam, ip_address="10.2.50.10", hostname="br-cam01", device_type="camera", description="Hikvision DS-2CD2143 — wejście")
Host.objects.create(subnet=s_br_cam, ip_address="10.2.50.11", hostname="br-cam02", device_type="camera", description="Hikvision DS-2CD2143 — parking")
Host.objects.create(subnet=s_br_cam, ip_address="10.2.50.12", hostname="br-cam03", device_type="camera", description="Hikvision DS-2CD2143 — magazyn")
Host.objects.create(subnet=s_br_cam, ip_address="10.2.50.100", hostname="br-nvr01", device_type="server", description="NVR Hikvision DS-7616")

# === Standalone Subnets ===
# Site-level standalone (management without VLAN)
s_hq_oob = Subnet.objects.create(
    project=p1, site=hq,
    network="10.0.250.0/24", gateway="10.0.250.1",
    description="Out-of-Band Management HQ (standalone)",
)
Host.objects.create(subnet=s_hq_oob, ip_address="10.0.250.10", hostname="hq-ipmi01", device_type="server", description="IPMI BMC serwer 1")
Host.objects.create(subnet=s_hq_oob, ip_address="10.0.250.11", hostname="hq-ipmi02", device_type="server", description="IPMI BMC serwer 2")

# Standalone subnet at HQ (road warrior VPN pool)
s_roadwarrior = Subnet.objects.create(
    project=p1,
    site=hq,
    network="10.0.200.0/24", gateway="10.0.200.1",
    description="WireGuard Road Warrior Pool",
)
Host.objects.create(subnet=s_roadwarrior, ip_address="10.0.200.10", hostname="rw-laptop-kowalski", device_type="workstation", description="Laptop VPN Kowalski")
Host.objects.create(subnet=s_roadwarrior, ip_address="10.0.200.11", hostname="rw-laptop-nowak", device_type="workstation", description="Laptop VPN Nowak")

# === Tunnels ===
Tunnel.objects.create(
    project=p1, name="HQ-DC GRE", tunnel_type="gre",
    site_a=hq, ip_a="172.16.0.1", site_b=dc, ip_b="172.16.0.2",
    tunnel_subnet="172.16.0.0/30", status="active",
    description="Tunel GRE między HQ a DC",
)
Tunnel.objects.create(
    project=p1, name="HQ-Branch IPsec", tunnel_type="ipsec",
    site_a=hq, ip_a="172.16.1.1", site_b=br, ip_b="172.16.1.2",
    tunnel_subnet="172.16.1.0/30", status="active",
    description="Tunel IPsec między HQ a Branch",
)
Tunnel.objects.create(
    project=p1, name="DC-Branch WireGuard", tunnel_type="wireguard",
    site_a=dc, ip_a="172.16.2.1", site_b=br, ip_b="172.16.2.2",
    tunnel_subnet="172.16.2.0/30", status="planned",
    description="Planowany WireGuard DC-Branch",
)

# === Project 2: Sieć Warszawa ===
p2 = Project.objects.create(
    name="Sieć Warszawa",
    description="Nowa sieć biurowa — etap planowania",
    supernet="10.10.0.0/16",
    created_by=admin,
)

waw_main = Site.objects.create(project=p2, name="Biuro Centrum", address="ul. Marszałkowska 100, 00-026 Warszawa",
                               latitude=52.228730, longitude=21.003490)
waw_co = Site.objects.create(project=p2, name="Coworking Mokotów", address="ul. Domaniewska 37, 02-672 Warszawa",
                              latitude=52.186180, longitude=20.998470)

vlan_waw_srv = VLAN.objects.create(site=waw_main, vlan_id=100, name="Servers", purpose="Serwery lokalne")
vlan_waw_usr = VLAN.objects.create(site=waw_main, vlan_id=20, name="Users", purpose="Stacje robocze")
vlan_co_usr = VLAN.objects.create(site=waw_co, vlan_id=20, name="Users", purpose="Stanowiska coworkingowe")

s_waw_srv = Subnet.objects.create(vlan=vlan_waw_srv, network="10.10.100.0/24", gateway="10.10.100.1")
s_waw_usr = Subnet.objects.create(vlan=vlan_waw_usr, network="10.10.20.0/24", gateway="10.10.20.1")
s_co_usr = Subnet.objects.create(vlan=vlan_co_usr, network="10.10.120.0/24", gateway="10.10.120.1")

Host.objects.create(subnet=s_waw_srv, ip_address="10.10.100.10", hostname="waw-srv01", device_type="server", description="Planowany serwer plików")
Host.objects.create(subnet=s_waw_usr, ip_address="10.10.20.10", hostname="waw-pc01", device_type="workstation")
Host.objects.create(subnet=s_co_usr, ip_address="10.10.120.10", hostname="co-pc01", device_type="workstation")

Tunnel.objects.create(
    project=p2, name="Centrum-Mokotów VPN", tunnel_type="wireguard",
    site_a=waw_main, ip_a="172.17.0.1", site_b=waw_co, ip_b="172.17.0.2",
    tunnel_subnet="172.17.0.0/30", status="planned",
    description="Planowany WireGuard między biurami",
)

print(f"Seed complete: {Project.objects.count()} projects, {Site.objects.count()} sites, "
      f"{VLAN.objects.count()} VLANs, {Subnet.objects.count()} subnets, "
      f"{Host.objects.count()} hosts, {Tunnel.objects.count()} tunnels")
