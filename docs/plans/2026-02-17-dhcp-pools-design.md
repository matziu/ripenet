# DHCP Pools — Design Document

## Cel

Dodanie pul DHCP jako nowego elementu hierarchii IPAM na poziomie subnetu. Hosty mogą być typu Static IP lub DHCP Static Lease (powiązane z pulą). Pule DHCP wliczają się do zajętości subnetu.

## Model danych

### Nowy model: `DHCPPool`

| Pole | Typ | Opis |
|------|-----|------|
| `subnet` | FK → Subnet | related_name="dhcp_pools" |
| `start_ip` | InetAddressField | początek zakresu |
| `end_ip` | InetAddressField | koniec zakresu |
| `description` | TextField, blank | opis puli |
| `created_at` | DateTimeField | auto |
| `updated_at` | DateTimeField | auto |

### Zmiany w modelu `Host`

| Pole | Typ | Opis |
|------|-----|------|
| `ip_type` | CharField(choices) | `static` (default) / `dhcp_lease` |
| `dhcp_pool` | FK → DHCPPool, null | related_name="leases", tylko dla dhcp_lease |

### Reguły walidacji

1. `start_ip` i `end_ip` muszą mieścić się w `subnet.network`
2. `start_ip < end_ip`
3. Pule w ramach subnetu nie mogą się nakładać
4. Host z `ip_type=static` — IP nie może wchodzić w zakres żadnej puli w subnecie
5. Host z `ip_type=dhcp_lease` — musi mieć `dhcp_pool`, IP musi być w zakresie puli
6. `dhcp_pool.subnet` musi == `host.subnet`

### Utilization

Zajętość subnetu = **hosty static + suma rozmiarów pul DHCP** (cała pula = zajęta, nie tylko leases wewnątrz).

## API (Backend)

### Nowy endpoint: DHCPPool CRUD

`/api/v1/ipam/dhcp-pools/`

| Metoda | URL | Opis |
|--------|-----|------|
| GET | `?subnet=X` | Lista pul dla subnetu |
| POST | `/` | Utwórz pulę |
| PATCH | `/{id}/` | Edytuj pulę |
| DELETE | `/{id}/` | Usuń (tylko jeśli brak leases) |

### Zmiany w Host API

- Serializer akceptuje `ip_type`, `dhcp_pool`
- Walidacja reguł 4-6

### Zmiany w Topology endpoint

`SubnetTopologySerializer` zwraca zagnieżdżone pule:

```python
class DHCPPoolTopologySerializer(ModelSerializer):
    leases = HostTopologySerializer(many=True, read_only=True)
    fields = ["id", "start_ip", "end_ip", "description", "leases"]

class SubnetTopologySerializer(ModelSerializer):
    hosts = ...              # tylko ip_type=static
    dhcp_pools = DHCPPoolTopologySerializer(many=True)
```

## Frontend

### Typy TypeScript

```typescript
interface DHCPPool {
  id: number
  subnet: number
  start_ip: string
  end_ip: string
  description: string
  created_at: string
  updated_at: string
}

interface DHCPPoolTopology {
  id: number
  start_ip: string
  end_ip: string
  description: string
  leases: HostTopology[]
}

// Host rozszerzony o:
ip_type: 'static' | 'dhcp_lease'
dhcp_pool: number | null
```

### Sidebar — hierarchia

```
Subnet 10.0.1.0/24  [utilization bar]
├── Host 10.0.1.1 (static)
├── Host 10.0.1.5 (static)
├── DHCP Pool 10.0.1.100–200
│   ├── Host 10.0.1.100 (lease)
│   └── Host 10.0.1.150 (lease)
└── DHCP Pool 10.0.1.220–240
```

- Hosty static jako bezpośrednie dzieci subnetu
- Pule DHCP jako rozwijalne kontenery z leases wewnątrz
- Klik na pulę → detail panel

### Detail Panel

**DHCPPoolDetail**: zakres, rozmiar (X adresów), leases (Y/X), lista leases, Edit/Delete.

### Utilization Bar

Zmiana logiki: `(staticHostCount + sum(poolSizes)) / usableHosts`

### Formularze

- **HostForm** — nowe pole `ip_type` (select). Dla `dhcp_lease`: dropdown z pulami, IP w zakresie puli.
- **DHCPPoolForm** — nowy: start_ip, end_ip, description. Dostępny z poziomu subnetu.

### Selection store

Dodać `selectedDhcpPoolId` + `setSelectedDhcpPool()`.

### Topology (SiteNode)

Bez zmian wizualnych — utilization bar pokaże zaktualizowaną wartość z pulami wliczonymi.

### API endpoints (frontend)

```typescript
dhcpPoolsApi = {
  list:   (subnetId) => GET /api/v1/ipam/dhcp-pools/?subnet=subnetId
  create: (data)     => POST /api/v1/ipam/dhcp-pools/
  update: (id, data) => PATCH /api/v1/ipam/dhcp-pools/{id}/
  delete: (id)       => DELETE /api/v1/ipam/dhcp-pools/{id}/
}
```
