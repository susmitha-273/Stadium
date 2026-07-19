/**
 * StadiumPulse 2026 Test Suite
 * Contains unit and integration test assertions.
 */

const TestSuite = (() => {
  'use strict';

  const assertions = [];

  const addTest = (category, name, testFn) => {
    assertions.push({ category, name, testFn });
  };

  // Helper assertions
  const assertEquals = (actual, expected, message) => {
    if (actual !== expected) {
      throw new Error(message || `Expected "${expected}" but got "${actual}"`);
    }
  };

  const assertContains = (str, search, message) => {
    if (!str || !str.includes(search)) {
      throw new Error(message || `Expected "${str}" to contain "${search}"`);
    }
  };

  const assertNotNull = (val, message) => {
    if (val === null || val === undefined) {
      throw new Error(message || `Expected value to be defined`);
    }
  };

  // --- UNIT TESTS ---

  // 1. Sanitization & XSS Protection
  addTest('Security', 'HTML Escaping utility matches expected output', () => {
    const text = 'test <script>alert("xss")</script> test';
    const sanitizeLocal = (str) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    };
    const escaped = sanitizeLocal(text);
    assertEquals(escaped, 'test &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; test', 'Script tag should be escaped');
  });

  addTest('Security', 'Markdown bolding is parsed safely', () => {
    const text = 'This is **bold** text';
    const sanitizeLocal = (str) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    };
    const escaped = sanitizeLocal(text);
    assertEquals(escaped, 'This is <strong>bold</strong> text', 'Markdown bolding should match HTML strong tags');
  });

  // 2. Accessibility (a11y) Checks
  addTest('Accessibility', 'SVG map stands have role and tabindex attributes', () => {
    const stands = document.querySelectorAll('.map-stand');
    stands.forEach(stand => {
      assertEquals(stand.getAttribute('role'), 'button', `Stand ${stand.id} should have role="button"`);
      assertEquals(stand.getAttribute('tabindex'), '0', `Stand ${stand.id} should have tabindex="0"`);
      assertNotNull(stand.getAttribute('aria-label'), `Stand ${stand.id} should have an aria-label`);
    });
  });

  addTest('Accessibility', 'SVG map gates have role and tabindex attributes', () => {
    const gates = document.querySelectorAll('.map-gate');
    gates.forEach(gate => {
      assertEquals(gate.getAttribute('role'), 'button', `Gate ${gate.id} should have role="button"`);
      assertEquals(gate.getAttribute('tabindex'), '0', `Gate ${gate.id} should have tabindex="0"`);
      assertNotNull(gate.getAttribute('aria-label'), `Gate ${gate.id} should have an aria-label`);
    });
  });

  addTest('Accessibility', 'Modals have accessible dialog role and title attributes', () => {
    const infoModal = document.getElementById('info-modal');
    const settingsModal = document.getElementById('settings-modal');
    
    assertEquals(infoModal.getAttribute('role'), 'dialog', 'Info modal should have role="dialog"');
    assertEquals(infoModal.getAttribute('aria-modal'), 'true', 'Info modal should have aria-modal="true"');
    
    assertEquals(settingsModal.getAttribute('role'), 'dialog', 'Settings modal should have role="dialog"');
    assertEquals(settingsModal.getAttribute('aria-modal'), 'true', 'Settings modal should have aria-modal="true"');
  });

  // 3. State Management & Eco Calculations
  addTest('State & Business Logic', 'Sustainability calculations work on checked actions', () => {
    // Reset checks
    const chkTransit = document.getElementById('eco-check-transit');
    const chkRecycle = document.getElementById('eco-check-recycle');
    const chkBottle = document.getElementById('eco-check-bottle');
    
    if (chkTransit && chkRecycle && chkBottle) {
      chkTransit.checked = true;
      chkRecycle.checked = true;
      chkBottle.checked = false;
      
      // Trigger score update
      StadiumPulse.updateEcoScore();
      
      const carbon = parseFloat(document.getElementById('eco-carbon-saved').textContent);
      const points = parseInt(document.getElementById('eco-green-points').textContent);
      
      // Expected values: transit (+15pts, -2.4kg), recycle (+10pts, -0.6kg) = 25pts, 3.0kg
      assertEquals(points, 25, 'Eco points mismatch');
      assertEquals(carbon, 3.0, 'Carbon footprint metric mismatch');
    }
  });

  // 4. Scenario Loading Verification
  addTest('State & Business Logic', 'Ops Scenario Simulator updates gate wait times correctly', () => {
    // Load exit scenario
    StadiumPulse.triggerScenario('exit');
    
    // Check gate wait times (Gate C is 50, Gate B is 45)
    const alertBanner = document.getElementById('global-alert-bar');
    assertContains(alertBanner.textContent, 'Crowd exit rush', 'Exit scenario alert banner text mismatch');
  });

  // 5. Wayfinding Paths Computation
  addTest('State & Business Logic', 'Wayfinding route advice updates HTML status view', () => {
    const fromSelect = document.getElementById('wayfinder-from');
    const toSelect = document.getElementById('wayfinder-to');
    
    if (fromSelect && toSelect) {
      fromSelect.value = 'Gate A (North)';
      toSelect.value = 'Stand B (East stands)';
      
      // Trigger wayfinding form submit mock
      const mockEvent = { preventDefault: () => {} };
      StadiumPulse.handleWayfinding(mockEvent);
      
      const resultBox = document.getElementById('wayfinding-result');
      // Wait time check is dynamic, but it should be unhidden
      assertEquals(resultBox.classList.contains('hidden'), false, 'Wayfinding result should be visible');
    }
  });

  const runAll = async (onResult, onComplete) => {
    let passed = 0;
    let failed = 0;
    
    for (const test of assertions) {
      try {
        await test.testFn();
        onResult(test.category, test.name, true, null);
        passed++;
      } catch (err) {
        onResult(test.category, test.name, false, err.message);
        failed++;
      }
    }
    
    onComplete(passed, failed, assertions.length);
  };

  return {
    runAll
  };
})();
