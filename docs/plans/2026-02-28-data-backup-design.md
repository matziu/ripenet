# Data Backup & Restore — Design

**Goal:** Export/import danych aplikacji (projekty, sieci, hosty, audit) z poziomu UI jako plik JSON.

**Format:** Django dumpdata/loaddata JSON — natywne, przenaszalne, czytelne.

**Dostęp:** Tylko admin.

## Export
- `GET /api/v1/backup/export/` → plik `ripenet-backup-YYYY-MM-DD.json`
- Zawiera dane z: projects, ipam, accounts, audit

## Import
- `POST /api/v1/backup/import/` → upload pliku JSON
- Opcja: replace (flush + load) lub merge (load bez flush)
- Dialog potwierdzenia w UI

## Frontend
- Strona `/settings` dostępna z TopBar (ikona gear, tylko admin)
- Dwa przyciski: Download backup / Restore from file
- Restore: dialog z upload + checkbox "Replace all data" + potwierdzenie
