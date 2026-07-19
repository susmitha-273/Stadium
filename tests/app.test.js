const fs = require('fs');
const path = require('path');

describe('StadiumPulse 2026 Logic Tests', () => {
  beforeEach(() => {
    // Load index.html DOM layout into JSDOM context
    const htmlPath = path.resolve(__dirname, '../index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    document.documentElement.innerHTML = html;

    // Load and evaluate app.js within JSDOM window
    const appPath = path.resolve(__dirname, '../app.js');
    const appJs = fs.readFileSync(appPath, 'utf8');
    
    const scriptEl = document.createElement('script');
    scriptEl.textContent = appJs;
    document.body.appendChild(scriptEl);

    // Initialize StadiumPulse manually since DOMContentLoaded won't fire in JSDOM manually parsed state
    window.StadiumPulse.start();
  });

  test('Sanitization escapes HTML tags and compiles markdown bolding safely', () => {
    const sanitize = window.StadiumPulse._sanitize;
    expect(sanitize('test <script>alert("xss")</script> test'))
      .toBe('test &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; test');
    expect(sanitize('This is **bold** text'))
      .toBe('This is <strong>bold</strong> text');
  });

  test('Sustainability actions recalculate green points and carbon saved', () => {
    const chkTransit = document.getElementById('eco-check-transit');
    const chkRecycle = document.getElementById('eco-check-recycle');
    
    chkTransit.checked = true;
    chkRecycle.checked = true;
    
    window.StadiumPulse.updateEcoScore();
    
    const state = window.StadiumPulse._state;
    expect(state.ecoPoints).toBe(25);
    expect(state.ecoCarbonSaved).toBeCloseTo(3.0, 1);
  });

  test('Crisis operations scenario loads correct stand densities and gate queue wait times', () => {
    window.StadiumPulse.triggerScenario('exit');
    const state = window.StadiumPulse._state;
    expect(state.stadiumState.stands['Stand C']).toBe('critical');
    expect(state.stadiumState.gates['Gate C']).toBe(50);
  });
});
