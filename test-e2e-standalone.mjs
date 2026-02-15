/**
 * E2E Tests for Standalone Subnets feature
 * Run: DISPLAY=localhost:10.0 node test-e2e-standalone.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
let passed = 0;
let failed = 0;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg) { console.log(`\x1b[36m[TEST]\x1b[0m ${msg}`); }
function pass(msg) { passed++; console.log(`\x1b[32m  ✓ ${msg}\x1b[0m`); }
function fail(msg) { failed++; console.log(`\x1b[31m  ✗ ${msg}\x1b[0m`); }

/** Get CSRF token from cookies */
async function getCSRF(page) {
  const cookies = await page.context().cookies();
  const csrf = cookies.find(c => c.name === 'csrftoken');
  return csrf ? csrf.value : '';
}

/** Fetch helper with CSRF */
async function apiFetch(page, url, options = {}) {
  const csrfToken = await getCSRF(page);
  return page.evaluate(async ({ url, options, csrfToken }) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }, { url, options, csrfToken });
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 80,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.setDefaultTimeout(10000);

  try {
    // ═══════════════════════════════════════════════════════════
    // SCENARIO 0: Login
    // ═══════════════════════════════════════════════════════════
    log('Scenario 0: Login');
    await page.goto(BASE);
    await sleep(1500);

    const usernameInput = page.locator('input').first();
    if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usernameInput.fill('admin');
      await page.locator('input[type="password"]').first().fill('admin');
      await page.locator('button[type="submit"]').click();
      await sleep(2000);
      pass('Logged in');
    } else {
      pass('Already logged in');
    }

    // ═══════════════════════════════════════════════════════════
    // SCENARIO 1: Navigate to project
    // ═══════════════════════════════════════════════════════════
    log('Scenario 1: Navigate to project');

    // Click "Inwestycja Kraków" in sidebar
    await page.locator('text=Inwestycja Kraków').first().click();
    await sleep(2000);

    const body = await page.textContent('body');
    body.includes('Inwestycja Kraków') ? pass('Project page loaded') : fail('Project page not loaded');

    // ═══════════════════════════════════════════════════════════
    // SCENARIO 2: Verify standalone subnets in sidebar
    // ═══════════════════════════════════════════════════════════
    log('Scenario 2: Sidebar — standalone subnets');

    const sidebar = page.locator('aside').first();

    // Find the row containing "HQ Kraków" and click its chevron button (first button child)
    const hqRow = sidebar.locator('div.group:has(button:has-text("HQ Kraków"))').first();
    if (await hqRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      // The first button in the row is the chevron toggle
      const chevron = hqRow.locator('button').first();
      await chevron.click();
      await sleep(2000);

      // Now check sidebar content after expansion
      const sidebarText = await sidebar.textContent();

      if (sidebarText.includes('Standalone')) {
        pass('Standalone label visible in sidebar');
      } else {
        fail('Standalone label not in sidebar');
      }

      if (sidebarText.includes('10.0.250.0/24')) {
        pass('OOB Management subnet (10.0.250.0/24) in sidebar');
      } else {
        fail('10.0.250.0/24 not in sidebar');
      }

      // Check VLANs still visible
      if (sidebarText.includes('VLAN 10') || sidebarText.includes('Management')) {
        pass('VLANs still visible alongside standalone subnets');
      } else {
        fail('VLANs not visible in sidebar');
      }
    } else {
      // Fallback: try clicking HQ text directly (it may auto-expand)
      const hqText = sidebar.locator('text=HQ Kraków').first();
      if (await hqText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await hqText.click();
        await sleep(2000);
        const sidebarText = await sidebar.textContent();
        if (sidebarText.includes('Standalone') || sidebarText.includes('10.0.250.0')) {
          pass('Standalone visible in sidebar (via text click fallback)');
        } else {
          fail('HQ expanded but standalone not visible');
        }
      } else {
        fail('HQ Kraków not found in sidebar');
      }
    }

    // ═══════════════════════════════════════════════════════════
    // SCENARIO 3: Table view — standalone subnets
    // ═══════════════════════════════════════════════════════════
    log('Scenario 3: Table view — standalone and project-wide subnets');

    // Go to table view
    await page.goto(`${BASE}/projects/1/table/network`);
    await sleep(2000);

    // Click Expand button
    const expandBtn = page.locator('button:has-text("Expand")').first();
    if (await expandBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expandBtn.click();
      await sleep(2000);
    }

    const tableText = await page.textContent('body');

    if (tableText.includes('Standalone Subnets') || tableText.includes('Standalone')) {
      pass('Standalone Subnets section in table view');
    } else {
      fail('Standalone section not in table view');
    }

    if (tableText.includes('10.0.250.0/24')) {
      pass('OOB subnet (10.0.250.0/24) in table');
    } else {
      fail('10.0.250.0/24 not in table');
    }

    if (tableText.includes('Project-Wide')) {
      pass('Project-Wide section in table');
    } else {
      fail('Project-Wide section not in table');
    }

    if (tableText.includes('10.0.200.0/24')) {
      pass('Road Warrior subnet (10.0.200.0/24) in table');
    } else {
      fail('10.0.200.0/24 not in table');
    }

    // Check VLAN subnets still present
    if (tableText.includes('VLAN 10') && tableText.includes('10.0.10.0/24')) {
      pass('VLAN subnets still visible in table');
    } else {
      fail('VLAN subnets missing from table');
    }

    // ═══════════════════════════════════════════════════════════
    // SCENARIO 4: CRUD standalone subnet (API + UI verify)
    // ═══════════════════════════════════════════════════════════
    log('Scenario 4: CRUD standalone subnet on DC site');

    // Get DC site ID
    const sitesResult = await apiFetch(page, '/api/v1/projects/1/sites/');
    const dc = sitesResult.data.results?.find(s => s.name.includes('DC'));

    if (!dc) {
      fail('DC site not found');
    } else {
      // Create standalone subnet
      const createResult = await apiFetch(page, '/api/v1/subnets/', {
        method: 'POST',
        body: JSON.stringify({
          project: 1,
          site: dc.id,
          vlan: null,
          network: '10.1.250.0/24',
          gateway: '10.1.250.1',
          description: 'E2E test standalone DC',
        }),
      });

      if (createResult.status === 201) {
        const subnet = createResult.data;
        pass(`Created standalone subnet ${subnet.network} (id=${subnet.id})`);

        if (subnet.project === 1 && subnet.site !== null && subnet.vlan === null) {
          pass(`Fields correct: project=${subnet.project}, site=${subnet.site}, vlan=null`);
        } else {
          fail(`Fields wrong: ${JSON.stringify(subnet)}`);
        }

        // Update
        const updateResult = await apiFetch(page, `/api/v1/subnets/${subnet.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ description: 'Updated description' }),
        });

        if (updateResult.status === 200 && updateResult.data.description === 'Updated description') {
          pass('Subnet updated successfully');
        } else {
          fail(`Update failed: ${JSON.stringify(updateResult)}`);
        }

        // Reload table to verify
        await page.reload();
        await sleep(2000);
        const expandBtn3 = page.locator('button:has-text("Expand")').first();
        if (await expandBtn3.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expandBtn3.click();
          await sleep(2000);
        }
        const afterCreate = await page.textContent('body');
        if (afterCreate.includes('10.1.250.0/24')) {
          pass('Created subnet visible in table after reload');
        } else {
          fail('Created subnet not visible in table after reload');
        }

        // Delete
        const delResult = await apiFetch(page, `/api/v1/subnets/${subnet.id}/`, {
          method: 'DELETE',
        });

        if (delResult.status === 204) {
          pass('Subnet deleted successfully');
        } else {
          fail(`Delete failed: status ${delResult.status}`);
        }
      } else {
        fail(`Create failed: ${JSON.stringify(createResult)}`);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // SCENARIO 5: Topology canvas
    // ═══════════════════════════════════════════════════════════
    log('Scenario 5: Topology canvas — standalone subnets');

    await page.goto(`${BASE}/projects/1/topology`);
    await sleep(3000);

    // Click on HQ Kraków node to expand it
    const hqNode = page.locator('text=HQ Kraków').first();
    if (await hqNode.isVisible({ timeout: 5000 }).catch(() => false)) {
      await hqNode.click();
      await sleep(2000);

      const topoContent = await page.textContent('body');

      // Check for VLANs (should always be visible when expanded)
      if (topoContent.includes('VLAN 10') || topoContent.includes('Management')) {
        pass('VLANs visible in expanded site node');
      } else {
        fail('VLANs not visible in topology node');
      }

      // Check for standalone section
      if (topoContent.includes('Standalone') || topoContent.includes('10.0.250.0')) {
        pass('Standalone subnets visible in topology');
      } else {
        // Click again (toggle may have collapsed)
        await hqNode.click();
        await sleep(2000);
        const topoContent2 = await page.textContent('body');
        if (topoContent2.includes('Standalone') || topoContent2.includes('10.0.250.0')) {
          pass('Standalone subnets visible in topology (second try)');
        } else {
          fail('Standalone subnets not in topology');
        }
      }
    } else {
      fail('HQ node not found in topology');
    }

    // ═══════════════════════════════════════════════════════════
    // SCENARIO 6: Overlap checking
    // ═══════════════════════════════════════════════════════════
    log('Scenario 6: Overlap checking');

    // Try to create overlapping subnet
    const overlapResult = await apiFetch(page, '/api/v1/subnets/', {
      method: 'POST',
      body: JSON.stringify({
        project: 1, site: null, vlan: null,
        network: '10.0.10.0/24',  // overlaps with HQ Management
        description: 'overlap test',
      }),
    });

    if (overlapResult.status === 400) {
      const errMsg = JSON.stringify(overlapResult.data);
      if (errMsg.includes('overlaps') || errMsg.includes('overlap')) {
        pass(`Overlap detected: ${errMsg.substring(0, 120)}`);
      } else {
        pass(`400 returned (overlap or validation): ${errMsg.substring(0, 120)}`);
      }
    } else {
      fail(`Expected 400, got ${overlapResult.status}: ${JSON.stringify(overlapResult.data).substring(0, 120)}`);
      // cleanup if accidentally created
      if (overlapResult.data?.id) {
        await apiFetch(page, `/api/v1/subnets/${overlapResult.data.id}/`, { method: 'DELETE' });
      }
    }

    // Non-overlapping should succeed
    const noOverlap = await apiFetch(page, '/api/v1/subnets/', {
      method: 'POST',
      body: JSON.stringify({
        project: 1, site: null, vlan: null,
        network: '10.99.0.0/24', gateway: '10.99.0.1',
        description: 'no-overlap test',
      }),
    });

    if (noOverlap.status === 201) {
      pass('Non-overlapping subnet created successfully');
      // Cleanup
      await apiFetch(page, `/api/v1/subnets/${noOverlap.data.id}/`, { method: 'DELETE' });
      pass('Cleaned up');
    } else {
      fail(`Non-overlapping creation failed: ${JSON.stringify(noOverlap)}`);
    }

    // ═══════════════════════════════════════════════════════════
    // SCENARIO 7: Existing VLAN flow not broken
    // ═══════════════════════════════════════════════════════════
    log('Scenario 7: Classic VLAN→Subnet flow not broken');

    // Find Guest VLAN (ID 99) at HQ
    const vlansResult = await apiFetch(page, '/api/v1/vlans/?site=1');
    const guestVlan = vlansResult.data.results?.find(v => v.vlan_id === 99);

    if (!guestVlan) {
      fail(`Guest VLAN not found. Available: ${vlansResult.data.results?.map(v => v.vlan_id)}`);
    } else {
      // Create subnet under VLAN (use unique range to avoid overlap with seed 10.0.99.0/24)
      const vlanFlow = await apiFetch(page, '/api/v1/subnets/', {
        method: 'POST',
        body: JSON.stringify({
          vlan: guestVlan.id,
          network: '10.0.98.0/24',
          gateway: '10.0.98.1',
          description: 'Guest pool 2 test',
        }),
      });

      if (vlanFlow.status === 201) {
        const d = vlanFlow.data;
        if (d.project === 1 && d.site === 1 && d.vlan !== null) {
          pass(`VLAN subnet auto-derived: project=${d.project}, site=${d.site}, vlan=${d.vlan}`);
        } else {
          fail(`Auto-derive wrong: ${JSON.stringify(d)}`);
        }

        // Create host under this subnet
        const hostResult = await apiFetch(page, '/api/v1/hosts/', {
          method: 'POST',
          body: JSON.stringify({
            subnet: d.id,
            ip_address: '10.0.98.100',
            hostname: 'test-guest-host',
            device_type: 'workstation',
          }),
        });

        if (hostResult.status === 201) {
          pass('Host created under VLAN subnet');
          // Cleanup host
          await apiFetch(page, `/api/v1/hosts/${hostResult.data.id}/`, { method: 'DELETE' });
        } else {
          fail(`Host creation failed: ${JSON.stringify(hostResult)}`);
        }

        // Cleanup subnet
        await apiFetch(page, `/api/v1/subnets/${d.id}/`, { method: 'DELETE' });
        pass('VLAN flow cleanup done');
      } else {
        fail(`VLAN subnet creation failed: ${JSON.stringify(vlanFlow)}`);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // SCENARIO 8: Search finds standalone subnet
    // ═══════════════════════════════════════════════════════════
    log('Scenario 8: Search finds standalone subnet');

    const searchResult = await apiFetch(page, '/api/v1/search/?q=Road+Warrior');

    if (searchResult.status === 200 && searchResult.data.results?.length > 0) {
      const subnet = searchResult.data.results.find(r => r.type === 'subnet');
      if (subnet) {
        pass(`Search found standalone subnet: "${subnet.label}" breadcrumb: "${subnet.breadcrumb}"`);
        if (!subnet.breadcrumb.includes('VLAN')) {
          pass('Breadcrumb correctly omits VLAN for standalone');
        } else {
          fail('Breadcrumb incorrectly includes VLAN');
        }
      } else {
        fail('Subnet not in search results');
      }
    } else {
      fail(`Search failed: ${JSON.stringify(searchResult)}`);
    }

    // ═══════════════════════════════════════════════════════════
    // RESULTS
    // ═══════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(50));
    console.log(`\x1b[32m  Passed: ${passed}\x1b[0m`);
    if (failed > 0) {
      console.log(`\x1b[31m  Failed: ${failed}\x1b[0m`);
    } else {
      console.log(`  Failed: 0`);
    }
    console.log('═'.repeat(50) + '\n');

    await sleep(3000);
  } catch (err) {
    console.error('\x1b[31mFatal error:\x1b[0m', err.message);
  } finally {
    await browser.close();
  }
})();
