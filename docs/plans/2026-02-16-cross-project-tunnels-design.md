# Design: Tunele międzyprojektowe i zewnętrzne

## Problem

Tunele są obecnie ograniczone do lokalizacji w ramach jednego projektu. W praktyce zdarzają się tunele:
- między lokalizacjami z różnych projektów (np. VM hostowana w Twojej serwerowni z tunelem do sieci klienta)
- do endpointów spoza systemu (np. VPN do dostawcy usług)

## Rozwiązanie

Trzy tryby tunelu w jednym modelu:

1. **Wewnętrzny** (domyślny) — oba site'y z tego samego projektu
2. **Międzyprojektowy** — site_a z bieżącego projektu, site_b z innego projektu
3. **Zewnętrzny** — site_a z bieżącego projektu, drugi koniec to wolny tekst

## Model danych

### Zmiany w `Tunnel`

```python
class Tunnel(models.Model):
    project = FK(Project)                           # projekt-właściciel (= projekt site_a)
    site_a  = FK(Site, required)                    # zawsze z bieżącego projektu
    site_b  = FK(Site, null=True, blank=True)       # z dowolnego projektu, lub null
    external_endpoint = CharField(blank=True)       # wypełniony gdy site_b=null
    # bez zmian: name, tunnel_type, tunnel_subnet, ip_a, ip_b, enabled, description
```

### Walidacja (serializer)

- `site_a.project == tunnel.project` (zawsze)
- Dokładnie jedno z: `site_b` lub `external_endpoint` — nie oba, nie żaden
- `site_b` może należeć do dowolnego projektu (brak ograniczenia `site_b.project == project`)

### Migracja

- `site_b`: zmiana na `null=True, blank=True`
- `external_endpoint`: nowe pole `CharField(max_length=300, blank=True, default="")`

## Topologia (backend)

Endpoint `/projects/{id}/topology/` zbiera tunele widoczne dla projektu:

```python
Tunnel.objects.filter(
    Q(project=project) | Q(site_b__project=project)
).distinct()
```

Tunele międzyprojektowe pojawiają się w topologii obu projektów. Serializer dodaje pole `site_b_project_id` i `site_b_project_name` dla cross-project tuneli.

## Frontend — formularz tunelu

### Tryb wyboru

Pod selectem site_b dwa checkboxy (wzajemnie wykluczające się):

- [ ] **Tunel zewnętrzny** — ukrywa select site_b, pokazuje pole tekstowe `external_endpoint`
- [ ] **Tunel do innego projektu** — zamienia select site_b na kaskadę: select projektu → select site'a z tamtego projektu

Domyślnie oba odznaczone = tunel wewnętrzny.

### Pola wspólne (zawsze widoczne)

- name, tunnel_type, site_a (z bieżącego projektu)
- tunnel_subnet, ip_a, ip_b
- enabled, description

## Frontend — wizualizacja

### Topologia (React Flow)

- **Wewnętrzny**: linia między dwoma site'ami (bez zmian)
- **Międzyprojektowy**: linia z badge/kafelkiem na końcu — `"Projekt X / Site Y"` — kliknięcie nawiguje do `/projects/{projectId}`; wyróżniony wizualnie (inny kolor lub styl linii)
- **Zewnętrzny**: linia wychodząca z site_a z etykietą `external_endpoint`; brak interakcji na drugim końcu

### Tabela

- Kolumna "Endpoints" pokazuje oba końce
- Międzyprojektowy: site_b jako link z prefixem nazwy projektu
- Zewnętrzny: tekst z `external_endpoint`

### Geo mapa

- **Międzyprojektowy z koordynatami**: linia na mapie, marker obcego site'a w innym kolorze, klik nawiguje do projektu
- **Zewnętrzny**: brak linii na mapie (brak koordynat), widoczny tylko w tabeli

## Typy TypeScript

```typescript
export interface Tunnel {
  // istniejące pola...
  site_b: number | null              // null dla zewnętrznych
  site_b_name: string | null
  site_b_project_id: number | null   // nowe — null gdy wewnętrzny lub external
  site_b_project_name: string | null // nowe
  external_endpoint: string          // nowe — pusty gdy site_b != null
}
```

## Zakres zmian

### Backend (4 pliki)
1. Model Tunnel — nullable site_b + external_endpoint + migracja
2. TunnelSerializer — walidacja, nowe pola project info
3. TunnelTopologySerializer — nowe pola
4. Topology view — query z Q() dla cross-project

### Frontend (5-6 plików)
1. types — aktualizacja Tunnel/TunnelTopology
2. Formularz tunelu — 3 tryby (checkboxy)
3. Topologia (React Flow) — renderowanie cross-project i external
4. Tabela — kolumna endpoints
5. Geo mapa — marker cross-project z nawigacją
6. Sidebar/detail panel — wyświetlanie info o tunelu

## Czego nie robimy

- Brak osobnych uprawnień per-projekt dla tuneli (edytuje właściciel, tj. projekt site_a)
- Brak notyfikacji w obcym projekcie o tunelu
- Brak "lustrzanego" tunelu — jeden rekord, widoczny w obu topologiach
