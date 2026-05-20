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

  function showResult(text, isProgressive = false) {
    const badge = isProgressive ? '<span class="progressive-badge">⏳ Mapping the bias...</span>' : '';
    resultContent.innerHTML = badge + renderMarkdown(text);
    showState('result');
    if (!isProgressive) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        chrome.storage.session.set({ cached_result: text, cached_at: Date.now(), cached_url: tab?.url || '' });
      });
    }
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
    chrome.storage.session.get(['cached_result', 'cached_at', 'cached_url'], (data) => {
      if (data.cached_result && data.cached_at && data.cached_url === currentUrl) {
        if (Date.now() - data.cached_at < 10 * 60 * 1000) {
          resultContent.innerHTML = renderMarkdown(data.cached_result);
          showState('result');
          return;
        }
      }
      chrome.storage.session.remove(['cached_result', 'cached_at', 'cached_url']);
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

      // Phase 1: Instant local preview
      showResult(`## 🔥 Scanning ${page.title.slice(0, 60)}\n\n**${domain}** · ${wordCount.toLocaleString()} words\n\n*Gemini is mapping the bias...*`, true);

      // Phase 2: Full bias heatmap
      const fullPrompt = `Article: "${page.title}"
URL: ${page.url}

Full text:
${page.text.slice(0, 8000)}

Analyze this article for bias and spin. Structure your response exactly as:

## 🔴 Loaded Language
Quote 3-5 sentences or phrases that use emotionally charged, manipulative, or one-sided language. For each, briefly explain why it's loaded.
1. "..." — [why it's loaded]
2. "..." — [why it's loaded]
3. "..." — [why it's loaded]

## 🟡 Unverified Claims
Quote 2-3 specific claims made without evidence, anonymous sourcing, or that need fact-checking.
1. "..." — [what's unverified]
2. "..." — [what's unverified]

## 🟢 Well-Attributed Facts
Quote 2-3 statements that are properly sourced, cited, or verifiable.
1. "..." — [source or reason it's credible]
2. "..." — [source or reason it's credible]

## 📊 Bias Summary
- **Direction:** [Left-leaning / Right-leaning / Center / Corporate / Sensationalist]
- **Bias score:** X/10 (0=neutral, 10=extreme bias)
- **Loaded phrases found:** [count]
- **Unsourced claims found:** [count]

## ⚡ One-Line Verdict
[Single sentence: what's the article's spin and who benefits from it]`;

      chrome.runtime.sendMessage(
        {
          action: 'callGeminiBackground',
          prompt: fullPrompt,
          options: {
            systemInstruction: 'You are a media literacy expert. Quote sentences verbatim from the article. Be precise and flag genuine manipulation — not generic concerns.',
            temperature: 0.4,
          },
        },
        (response) => {
          if (response?.success) showResult(response.data, false);
          else showError(response?.error || 'Analysis failed. Try again.');
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