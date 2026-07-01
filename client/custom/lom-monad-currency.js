(function () {
  'use strict';

  if (window.LoMMonadCurrencyLoaded) return;
  window.LoMMonadCurrencyLoaded = true;

  var cfg = Object.assign({
    tokenSymbol: '$LoN',
    tokenAddress: '',
    contractAddress: '',
    tokenDecimals: 18,
    monadRpcUrl: 'https://rpc.monad.xyz',
    monadExplorerUrl: 'https://monadvision.com',
    nadFunUrl: 'https://nad.fun',
    nadFunTokenUrl: '',
    replaceOldCurrencyUi: true,
    showBalanceInInventory: true,
    refreshBalanceMs: 15000
  }, window.LOM_WEB3_CONFIG || {});

  var lastBalanceText = '--';
  var timer = null;

  function isAddress(x) { return /^0x[a-fA-F0-9]{40}$/.test(String(x || '')); }
  function tokenAddress() { return cfg.tokenAddress || cfg.contractAddress || ''; }
  function walletAddress() {
    var w = window.LoMWalletGate && window.LoMWalletGate.getWallet && window.LoMWalletGate.getWallet();
    return w && w.address ? w.address : '';
  }
  function strip0x(x) { return String(x || '').replace(/^0x/i, ''); }
  function pad64(x) { return strip0x(x).toLowerCase().padStart(64, '0'); }
  function shortAddr(addr) {
    if (window.LoMWalletGate && window.LoMWalletGate.shortAddr) return window.LoMWalletGate.shortAddr(addr);
    return addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';
  }
  function setText(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }

  function formatUnits(hexValue, decimals) {
    decimals = Number.isFinite(Number(decimals)) ? Number(decimals) : 18;
    var raw;
    try { raw = BigInt(hexValue || '0x0'); } catch (_) { raw = 0n; }
    var base = 10n ** BigInt(decimals);
    var whole = raw / base;
    var frac = raw % base;
    var fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 4);
    var wholeStr = whole.toString().replace(/B(?=(d{3})+(?!d))/g, ',');
    return fracStr ? (wholeStr + '.' + fracStr) : wholeStr;
  }

  async function rpcCall(method, params) {
    var body = { jsonrpc: '2.0', id: Date.now(), method: method, params: params || [] };
    var res = await fetch(cfg.monadRpcUrl || 'https://rpc.monad.xyz', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    var json = await res.json();
    if (json.error) throw new Error(json.error.message || 'RPC error');
    return json.result;
  }

  async function readLonBalance(addr) {
    var ca = tokenAddress();
    if (!isAddress(addr)) throw new Error('Wallet not connected');
    if (!isAddress(ca)) throw new Error('CA missing');
    var data = '0x70a08231' + pad64(addr);
    var result = await rpcCall('eth_call', [{ to: ca, data: data }, 'latest']);
    return formatUnits(result, cfg.tokenDecimals || 18);
  }

  function hideOldCurrency() {
    if (!cfg.replaceOldCurrencyUi) return;
    document.body.classList.add('lom-onchain-currency');
    try {
      var selectors = ['.inventoryGoldFrame', '.inventoryGemsFrame', '.inventorySellGoldFrame'];
      selectors.forEach(function (sel) {
        Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
          if (!el.closest || !el.closest('#lom-onchain-currency-frame')) el.style.display = 'none';
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll('.inventoryGold, .inventoryGems, .inventorySellGold'), function (el) {
        el.textContent = '';
      });
    } catch (_) {}
  }

  function makeAnchor(label, href, disabled) {
    var a = document.createElement('a');
    a.textContent = label;
    if (disabled) {
      a.href = '#';
      a.className = 'is-disabled';
      a.onclick = function (e) { e.preventDefault(); if (window.LoMWalletGate) window.LoMWalletGate.showWarning('CA/token page will be added after launch.'); };
    } else {
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  }

  function ensureInventoryFrame() {
    if (!cfg.showBalanceInInventory) return null;
    var existing = document.getElementById('lom-onchain-currency-frame');
    if (existing) return existing;

    var frame = document.createElement('div');
    frame.id = 'lom-onchain-currency-frame';
    frame.className = 'lom-onchain-currency-frame lom-keep-currency';

    var title = document.createElement('div');
    title.id = 'lom-onchain-currency-title';
    title.textContent = 'Inventory Currency';
    frame.appendChild(title);

    var bal = document.createElement('div');
    bal.id = 'lom-lon-balance';
    bal.textContent = (cfg.tokenSymbol || '$LoN') + ': --';
    frame.appendChild(bal);

    var sub = document.createElement('div');
    sub.id = 'lom-lon-sub';
    sub.textContent = 'Ticker: ' + (cfg.tokenSymbol || '$LoN') + ' · Monad on-chain balance';
    frame.appendChild(sub);

    var actions = document.createElement('div');
    actions.id = 'lom-onchain-currency-actions';

    var refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.textContent = 'Refresh';
    refresh.onclick = function (e) { e.preventDefault(); refreshBalance(true); };
    actions.appendChild(refresh);

    var ca = tokenAddress();
    var explorerHref = ca ? ((cfg.monadExplorerUrl || 'https://monadvision.com') + '/address/' + ca) : '#';
    actions.appendChild(makeAnchor(ca ? 'View CA' : 'CA soon', explorerHref, !ca));

    var nadUrl = cfg.nadFunTokenUrl || cfg.nadFunUrl || 'https://nad.fun';
    actions.appendChild(makeAnchor('nad.fun', nadUrl, false));

    frame.appendChild(actions);

    var inv = document.getElementById('allinventorywindow');
    if (inv) inv.insertBefore(frame, inv.firstChild);
    else document.body.appendChild(frame);
    return frame;
  }

  function updateBalanceText(text, subText) {
    lastBalanceText = text;
    setText('lom-lon-balance', text);
    setText('lom-lon-top-balance', text.replace((cfg.tokenSymbol || '$LoN') + ': ', (cfg.tokenSymbol || '$LoN') + ': '));
    if (subText) setText('lom-lon-sub', subText);
  }

  async function refreshBalance(userClicked) {
    hideOldCurrency();
    ensureInventoryFrame();
    var addr = walletAddress();
    var ca = tokenAddress();
    var sym = cfg.tokenSymbol || '$LoN';

    if (!isAddress(addr)) {
      updateBalanceText(sym + ': connect wallet', 'Connect wallet first.');
      return;
    }
    if (!isAddress(ca)) {
      updateBalanceText(sym + ': CA soon', 'Wallet: ' + shortAddr(addr) + ' · paste token CA after nad.fun launch.');
      return;
    }

    updateBalanceText(sym + ': loading...', 'Wallet: ' + shortAddr(addr) + ' · Monad');
    try {
      var balance = await readLonBalance(addr);
      updateBalanceText(sym + ': ' + balance, 'Wallet: ' + shortAddr(addr) + ' · on-chain balance');
      window.dispatchEvent(new CustomEvent('lom:lon-balance', { detail: { address: addr, token: ca, balance: balance, symbol: sym } }));
    } catch (err) {
      updateBalanceText(sym + ': error', (err && err.message ? err.message : 'Could not read token balance'));
      if (userClicked && window.LoMWalletGate) window.LoMWalletGate.showWarning('Could not read ' + sym + ' balance. Check CA/RPC.');
    }
  }

  function patchInventorySetCurrency() {
    try {
      if (!window.game || !game.inventory || !game.inventory.setCurrency || game.inventory._lomOnChainPatched) return;
      game.inventory._lomOldSetCurrency = game.inventory.setCurrency;
      game.inventory.setCurrency = function () {
        hideOldCurrency();
        ensureInventoryFrame();
        refreshBalance(false);
      };
      game.inventory._lomOnChainPatched = true;
    } catch (_) {}
  }

  function patchKnownGoldTexts() {
    try {
      // Replace visible labels when they are text nodes. This is light, safe, and non-duplicating.
      Array.prototype.forEach.call(document.querySelectorAll('body *'), function (el) {
        if (!el || el.children.length > 0) return;
        var t = (el.textContent || '').trim();
        if (t === 'GEMS' || t === 'Gems' || t === 'Gold' || t === 'GOLD') el.textContent = cfg.tokenSymbol || '$LoN';
      });
    } catch (_) {}
  }

  function init() {
    hideOldCurrency();
    ensureInventoryFrame();
    patchInventorySetCurrency();
    patchKnownGoldTexts();
    refreshBalance(false);
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      hideOldCurrency();
      ensureInventoryFrame();
      patchInventorySetCurrency();
      refreshBalance(false);
    }, Number(cfg.refreshBalanceMs || 15000));
  }

  window.LoMMonadCurrency = {
    refresh: refreshBalance,
    readBalance: readLonBalance,
    hideOldCurrency: hideOldCurrency,
    ensureInventoryFrame: ensureInventoryFrame,
    getLastBalanceText: function () { return lastBalanceText; }
  };

  window.addEventListener('lom:wallet-connected', function () { refreshBalance(false); });
  window.addEventListener('lom:wallet-disconnected', function () { refreshBalance(false); });
  window.addEventListener('lom:chain-changed', function () { refreshBalance(false); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshBalance(false); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
