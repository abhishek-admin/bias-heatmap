// ============================================
// POPUP.JS TEMPLATE
// Features: markdown rendering, progressive loading,
// session cache, settings panel, re-analyze
// Only modify: ACTION LOGIC between ▼▼▼ and ▲▲▲
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const actionBtn = document.getElementById('action-btn');
  const retryBtn = document.getElementById('retry-btn');
  const copyBtn = document.getElementById('copy-btn');
  const rerunBtn = document.getElementById('rerun-btn');
  const mainContent = document.getElementById('main-content');
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');
  const resultContent = document.getElementById('result-content');
  const error = document.getElementById('error');
  const errorMessage = document.getElementById('error-message');

  const wrongPage = document.getElementById('wrong-page');
  const wrongPageRetryBtn = document.getElementById('wrongpage-retry-btn');

  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsClose = document.getElementById('settings-close');
  const geminiKeyInput = document.getElementById('gemini-key-input');
  const openrouterKeyInput = document.getElementById('openrouter-key-input');
  const saveKeysBtn = document.getElementById('save-keys-btn');
  const clearKeysBtn = document.getElementById('clear-keys-btn');
  const toggleGeminiKey = document.getElementById('toggle-gemini-key');
  const toggleOpenrouterKey = document.getElementById('toggle-openrouter-key');

  const onboarding = document.getElementById('onboarding');
  const onboardGeminiInput = document.getElementById('onboard-gemini-input');
  const onboardOpenrouterInput = document.getElementById('onboard-openrouter-input');
  const onboardSaveBtn = document.getElementById('onboard-save-btn');

  // ---- Markdown → HTML ----

  function renderMarkdown(text) {
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^---$/gm, '<hr>');

    html = html.replace(/((?:^\|.+\|$\n?)+)/gm, (tableBlock) => {
      const rows = tableBlock.trim().split('\n').filter(r => r.trim());
      if (rows.length < 2 || !/^\|[\s\-:]+\|/.test(rows[1])) return tableBlock;
      const parseRow = (row) => row.split('|').slice(1, -1).map(c => c.trim());
      const headers = parseRow(rows[0]);
      let table = '<table><thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
      rows.slice(2).forEach(row => {
        const cells = parseRow(row);
        table += '<tr>' + cells.map(c => `<td>${c.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</td>`).join('') + '</tr>';
      });
      return table + '</tbody></table>';
    });

    html = html.replace(/((?:^- .+$\n?)+)/gm, (block) => {
      return '<ul>' + block.trim().split('\n').map(l => `<li>${l.replace(/^- /, '').trim()}</li>`).join('') + '</ul>';
    });

    html = html.replace(/((?:^\d+\. .+$\n?)+)/gm, (block) => {
      return '<ol>' + block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '').trim()}</li>`).join('') + '</ol>';
    });

    html = html.split(/\n{2,}/).map(chunk => {
      const t = chunk.trim();
      if (!t) return '';
      if (/^<(h[2-4]|ul|ol|table|hr)/.test(t)) return t;
      return `<p>${t.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
  }

  // ---- UI State Machine ----

  function showState(state) {
    mainContent.classList.toggle('hidden', state !== 'idle');
    loading.classList.toggle('hidden', state !== 'loading');
    result.classList.toggle('hidden', state !== 'result');
    error.classList.toggle('hidden', state !== 'error');
    wrongPage.classList.toggle('hidden', state !== 'wrongpage');
    if (state === 'result') result.classList.add('fade-in');
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    showState('error');
  }

  // ---- Non-news page detector ----

  function isNonArticlePage(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace('www.', '');
      if (host.startsWith('google.') && (u.pathname.startsWith('/search') || u.search.includes('q='))) return true;
      if (host === 'bing.com' && u.pathname.startsWith('/search')) return true;
      if (host === 'duckduckgo.com') return true;
      if (host === 'yahoo.com' && (u.pathname.startsWith('/search') || u.search.includes('p='))) return true;
      const nonArticle = ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'linkedin.com', 'threads.net', 'pinterest.com', 'youtube.com', 'youtu.be', 'reddit.com'];
      return nonArticle.some(d => host === d || host.endsWith('.' + d));
    } catch { return false; }
  }

  // ---- First-run onboarding ----

  function showOnboarding() {
    onboarding.classList.remove('hidden');
    mainContent.classList.add('hidden');
    loading.classList.add('hidden');
    result.classList.add('hidden');
    error.classList.add('hidden');
    wrongPage.classList.add('hidden');
  }

  function hideOnboarding() {
    onboarding.classList.add('hidden');
  }

  document.getElementById('onboard-toggle-gemini').addEventListener('click', () => {
    onboardGeminiInput.type = onboardGeminiInput.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('onboard-toggle-openrouter').addEventListener('click', () => {
    onboardOpenrouterInput.type = onboardOpenrouterInput.type === 'password' ? 'text' : 'password';
  });

  onboardSaveBtn.addEventListener('click', () => {
    const gk = onboardGeminiInput.value.trim();
    const ok = onboardOpenrouterInput.value.trim();
    if (!gk && !ok) {
      onboardSaveBtn.textContent = '⚠️ Enter at least one key';
      setTimeout(() => { onboardSaveBtn.textContent = 'Get Started →'; }, 2000);
      return;
    }
    const updates = {};
    if (gk) updates.gemini_api_key = gk;
    if (ok) updates.openrouter_api_key = ok;
    chrome.storage.local.set(updates, () => {
      hideOnboarding();
      initApp();
    });
  });

  // ---- Restore cache on popup open (URL-aware) ----

  function initApp() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const currentUrl = tab?.url || '';
    if (!currentUrl || currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://')) {
      showState('idle');
      return;
    }
    if (isNonArticlePage(currentUrl)) {
      showState('wrongpage');
      return;
    }
    chrome.storage.session.get(['cached_result', 'cached_at', 'cached_url', 'cached_domain', 'cached_wordcount'], (data) => {
      if (data.cached_result && data.cached_at && data.cached_url === currentUrl) {
        if (Date.now() - data.cached_at < 10 * 60 * 1000) {
          const parsed = parseStructured(data.cached_result);
          resultContent.innerHTML = buildScorecardHTML(parsed, data.cached_domain || currentUrl, data.cached_wordcount || 0);
          showState('result');
          return;
        }
      }
      chrome.storage.session.remove(['cached_result', 'cached_at', 'cached_url', 'cached_domain', 'cached_wordcount']);
      showState('idle');
    });
  });
  } // end initApp

  chrome.storage.local.get(['gemini_api_key', 'openrouter_api_key'], (keys) => {
    if (!keys.gemini_api_key && !keys.openrouter_api_key) {
      showOnboarding();
    } else {
      initApp();
    }
  });

  // ============================================
  // ▼▼▼ ACTION LOGIC — MODIFY THIS PER PROJECT ▼▼▼
  // ============================================

  async function getPageContent() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found.');
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot read Chrome internal pages. Navigate to a website first.');
    }
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
      if (response && response.text && response.text.length > 100) return response;
    } catch (e) { /* content script not injected */ }
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const article = document.querySelector('article') || document.querySelector('main') || document.body;
          const clone = article.cloneNode(true);
          clone.querySelectorAll('script, style, nav, footer, aside, header, iframe, .ad, [role="navigation"]')
            .forEach(el => el.remove());
          return {
            title: document.title,
            url: window.location.href,
            text: clone.innerText.replace(/\n{3,}/g, '\n\n').trim().slice(0, 15000),
            metaDescription: document.querySelector('meta[name="description"]')?.content || '',
          };
        },
      });
      if (results?.[0]?.result) return results[0].result;
    } catch (e) { /* scripting failed too */ }
    return { title: tab.title || '', url: tab.url || '', text: '', metaDescription: '' };
  }

  // ---- Structured response parser ----

  function parseStructured(raw) {
    const get = (key) => {
      const m = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim() : '';
    };
    const getBlock = (key) => {
      const m = raw.match(new RegExp(`^${key}:\\s*\\n([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`, 'm'));
      if (!m) return [];
      return m[1].trim().split('\n')
        .filter(l => /^\d+\./.test(l.trim()))
        .map(l => {
          const body = l.replace(/^\d+\.\s*/, '').trim();
          const sep = body.indexOf(' — ');
          if (sep === -1) return { text: body, reason: '' };
          return { text: body.slice(0, sep).replace(/^[""]|[""]$/g, ''), reason: body.slice(sep + 3) };
        });
    };
    return {
      score: Math.min(10, Math.max(0, parseInt(get('BIAS_SCORE')) || 5)),
      direction: get('DIRECTION') || 'Unknown',
      loadedCount: parseInt(get('LOADED_COUNT')) || 0,
      unverifiedCount: parseInt(get('UNVERIFIED_COUNT')) || 0,
      sourcedCount: parseInt(get('SOURCED_COUNT')) || 0,
      verdict: get('VERDICT'),
      loaded: getBlock('LOADED_PHRASES'),
      unverified: getBlock('UNVERIFIED'),
      sourced: getBlock('SOURCED'),
    };
  }

  // ---- Visual scorecard builder ----

  function directionClass(d) {
    const dl = d.toLowerCase();
    if (dl.includes('left')) return 'left';
    if (dl.includes('right')) return 'right';
    if (dl.includes('center') || dl.includes('neutral')) return 'center';
    if (dl.includes('sensation')) return 'sensationalist';
    return 'corporate';
  }

  function buildScorecardHTML(data, domain, wordCount) {
    const pct = (data.score / 10 * 100).toFixed(1);
    const dc = directionClass(data.direction);

    const meter = `
      <div class="bias-meter-wrap">
        <div class="bias-meter-header">
          <span class="bias-meter-label">Bias Level</span>
          <span class="bias-score-big">${data.score}<span class="bias-score-denom">/10</span></span>
        </div>
        <div class="bias-meter-track">
          <div class="bias-meter-needle" style="left:${pct}%"></div>
        </div>
        <div class="bias-meter-ticks">
          <span>Neutral</span><span>Moderate</span><span>Extreme</span>
        </div>
      </div>`;

    const grid = `
      <div class="metric-grid">
        <div class="metric-tile accent-tile">
          <div class="metric-number">${data.score}/10</div>
          <div class="metric-label">Bias Score</div>
        </div>
        <div class="metric-tile">
          <div class="metric-number" style="color:#ef4444">${data.loadedCount}</div>
          <div class="metric-label">Loaded Phrases</div>
        </div>
        <div class="metric-tile">
          <div class="metric-number" style="color:#eab308">${data.unverifiedCount}</div>
          <div class="metric-label">Unverified Claims</div>
        </div>
        <div class="metric-tile">
          <div class="metric-number" style="color:#22c55e">${data.sourcedCount}</div>
          <div class="metric-label">Sourced Facts</div>
        </div>
      </div>`;

    const dirRow = `
      <div class="direction-row">
        <span class="direction-badge ${dc}">${data.direction}</span>
        <span class="verdict-text">${data.verdict}</span>
      </div>`;

    const quotes = (items, cls, label) => {
      if (!items.length) return '';
      const cards = items.map(q => `
        <div class="quote-card ${cls}">
          <div class="quote-text">"${q.text}"</div>
          ${q.reason ? `<div class="quote-reason">↳ ${q.reason}</div>` : ''}
        </div>`).join('');
      return `<div class="quote-section-title">${label}</div>${cards}`;
    };

    const meta = `<div style="font-size:10px;color:#555568;margin-bottom:8px;">${domain} · ${wordCount.toLocaleString()} words analysed</div>`;

    return meta + meter + grid + dirRow
      + quotes(data.loaded, 'loaded', '🔴 Loaded Language')
      + quotes(data.unverified, 'unverified', '🟡 Unverified Claims')
      + quotes(data.sourced, 'sourced', '🟢 Well-Sourced Facts');
  }

  async function runAction() {
    showState('loading');
    try {
      const page = await getPageContent();
      if (!page.text || page.text.length < 200) {
        showError('Not enough text to analyze. Try a news article or blog post.');
        return;
      }

      const wordCount = page.text.split(/\s+/).length;
      const domain = new URL(page.url).hostname.replace('www.', '');

      // Phase 1: instant local preview
      resultContent.innerHTML = `
        <div style="font-size:10px;color:#555568;margin-bottom:8px;">${domain} · ${wordCount.toLocaleString()} words</div>
        <div class="bias-meter-wrap">
          <div class="bias-meter-header">
            <span class="bias-meter-label">Bias Level</span>
            <span class="bias-score-big">?<span class="bias-score-denom">/10</span></span>
          </div>
          <div class="bias-meter-track"><div class="bias-meter-needle" style="left:50%"></div></div>
          <div class="bias-meter-ticks"><span>Neutral</span><span>Moderate</span><span>Extreme</span></div>
        </div>
        <p class="scan-inline">⏳ Mapping bias in ${wordCount.toLocaleString()} words...</p>`;
      showState('result');

      // Phase 2: structured Gemini call
      const fullPrompt = `Article: "${page.title}"
URL: ${page.url}

Full text:
${page.text.slice(0, 8000)}

Analyze this article for bias. Respond ONLY in this exact format — no extra text, no markdown:

BIAS_SCORE: [integer 0-10, where 0=completely neutral, 10=extreme bias]
DIRECTION: [exactly one of: Left-leaning / Right-leaning / Center / Sensationalist / Corporate]
LOADED_COUNT: [integer, total loaded/charged phrases found]
UNVERIFIED_COUNT: [integer, total unverified claims found]
SOURCED_COUNT: [integer, total well-attributed facts found]
VERDICT: [single sentence — what spin does this article have and who benefits from it]
LOADED_PHRASES:
1. "exact quote from article" — reason it's loaded
2. "exact quote from article" — reason it's loaded
3. "exact quote from article" — reason it's loaded
UNVERIFIED:
1. "exact claim from article" — what is unverified or missing
2. "exact claim from article" — what is unverified or missing
SOURCED:
1. "exact statement from article" — why it is credible or well-attributed
2. "exact statement from article" — why it is credible or well-attributed

Rules: all quotes must be verbatim from the article. LOADED_COUNT/UNVERIFIED_COUNT/SOURCED_COUNT must equal the actual number of items you list. No markdown, no headers, no deviations.`;

      chrome.runtime.sendMessage(
        {
          action: 'callGeminiBackground',
          prompt: fullPrompt,
          options: {
            systemInstruction: 'You are a media literacy expert. Return structured data exactly as requested. Every quote must be verbatim from the article. Numbers must be accurate counts.',
            temperature: 0.3,
          },
        },
        (response) => {
          if (response?.success) {
            const data = parseStructured(response.data);
            resultContent.innerHTML = buildScorecardHTML(data, domain, wordCount);
            showState('result');
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
              chrome.storage.session.set({ cached_result: response.data, cached_at: Date.now(), cached_url: tab?.url || '', cached_domain: domain, cached_wordcount: wordCount });
            });
          } else {
            showError(response?.error || 'Analysis failed. Try again.');
          }
        }
      );
    } catch (err) {
      showError(err.message || 'Something went wrong.');
    }
  }

  // ============================================
  // ▲▲▲ END ACTION LOGIC ▲▲▲
  // ============================================

  // ---- Settings Panel ----

  function openSettings() {
    settingsPanel.classList.remove('hidden');
    settingsPanel.classList.add('fade-in');
    chrome.storage.local.get(['gemini_api_key', 'openrouter_api_key'], (data) => {
      geminiKeyInput.value = data.gemini_api_key || '';
      openrouterKeyInput.value = data.openrouter_api_key || '';
    });
  }

  function closeSettings() {
    settingsPanel.classList.add('hidden');
    settingsPanel.classList.remove('fade-in');
  }

  settingsBtn.addEventListener('click', openSettings);
  settingsClose.addEventListener('click', closeSettings);

  toggleGeminiKey.addEventListener('click', () => {
    geminiKeyInput.type = geminiKeyInput.type === 'password' ? 'text' : 'password';
  });
  toggleOpenrouterKey.addEventListener('click', () => {
    openrouterKeyInput.type = openrouterKeyInput.type === 'password' ? 'text' : 'password';
  });

  saveKeysBtn.addEventListener('click', () => {
    const updates = {};
    const gk = geminiKeyInput.value.trim();
    const ok = openrouterKeyInput.value.trim();
    if (gk) updates.gemini_api_key = gk;
    if (ok) updates.openrouter_api_key = ok;
    if (Object.keys(updates).length === 0) return;
    chrome.storage.local.set(updates, () => {
      saveKeysBtn.textContent = '✅ Saved';
      setTimeout(() => { saveKeysBtn.textContent = 'Save Keys'; }, 1500);
    });
  });

  clearKeysBtn.addEventListener('click', async () => {
    await resetApiKeys();
    geminiKeyInput.value = '';
    openrouterKeyInput.value = '';
    clearKeysBtn.textContent = '✅ Cleared';
    setTimeout(() => { clearKeysBtn.textContent = 'Clear All Keys'; }, 1500);
  });

  // ---- Event Listeners ----

  actionBtn.addEventListener('click', runAction);

  retryBtn.addEventListener('click', () => {
    chrome.storage.session.remove(['cached_result', 'cached_at', 'cached_url']);
    showState('idle');
  });

  rerunBtn.addEventListener('click', () => {
    chrome.storage.session.remove(['cached_result', 'cached_at', 'cached_url']);
    runAction();
  });

  wrongPageRetryBtn.addEventListener('click', () => {
    chrome.storage.session.remove(['cached_result', 'cached_at', 'cached_url']);
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.url && isNonArticlePage(tab.url)) {
        showState('wrongpage');
      } else {
        showState('idle');
      }
    });
  });

  copyBtn.addEventListener('click', () => {
    const temp = document.createElement('div');
    temp.innerHTML = resultContent.innerHTML;
    const text = temp.textContent || temp.innerText;
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = '✅';
      setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
    });
  });
});