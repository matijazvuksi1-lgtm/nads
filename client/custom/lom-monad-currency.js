(function () {
  'use strict';

  if (window.LoMMonadCurrencyLoaded) return;
  window.LoMMonadCurrencyLoaded = true;

  var cfg = Object.assign({
    tokenSymbol: '$LoN',
    tokenAddress: '0x53Bc12b090CfC365E7394d1cC745F8ac04117777',
    contractAddress: '0x53Bc12b090CfC365E7394d1cC745F8ac04117777',
    tokenDecimals: 18,
    monadRpcUrl: 'https://rpc.monad.xyz',
    monadExplorerUrl: 'https://monadvision.com',
    nadFunUrl: 'https://nad.fun',
    nadFunTokenUrl: 'https://nad.fun/tokens/0x53Bc12b090CfC365E7394d1cC745F8ac04117777',
    payoutApiUrl: '',
    replaceOldCurrencyUi: true,
    showBalanceInInventory: true,
    refreshBalanceMs: 15000,
    pointsPerToken: 100
  }, window.LOM_WEB3_CONFIG || {});

  var lastBalanceText = '--';
  var timer = null;

  // Display only. Real payout is checked by backend from saved gold.
  var sessionEarnedGold = 0;
  var seenGoldMessages = {};
  var goldObserverStarted = false;

  function isAddress(x) {
    return /^0x[a-fA-F0-9]{40}$/.test(String(x || ''));
  }

  function tokenAddress() {
    return cfg.tokenAddress || cfg.contractAddress || '';
  }

  function walletAddress() {
    var w = window.LoMWalletGate && window.LoMWalletGate.getWallet && window.LoMWalletGate.getWallet();
    return w && w.address ? w.address : '';
  }

  function strip0x(x) {
    return String(x || '').replace(/^0x/i, '');
  }

  function pad64(x) {
    return strip0x(x).toLowerCase().padStart(64, '0');
  }

  function shortAddr(addr) {
    if (window.LoMWalletGate && window.LoMWalletGate.shortAddr) return window.LoMWalletGate.shortAddr(addr);
    return addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatUnits(hexValue, decimals) {
    decimals = Number.isFinite(Number(decimals)) ? Number(decimals) : 18;

    var raw;
    try {
      raw = BigInt(hexValue || '0x0');
    } catch (_) {
      raw = 0n;
    }

    var base = 10n ** BigInt(decimals);
    var whole = raw / base;
    var frac = raw % base;
    var fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 4);
    var wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return fracStr ? (wholeStr + '.' + fracStr) : wholeStr;
  }

  async function rpcCall(method, params) {
    var body = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: method,
      params: params || []
    };

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
      var selectors = [
        '.inventoryGoldFrame',
        '.inventoryGemsFrame',
        '.inventorySellGoldFrame'
      ];

      selectors.forEach(function (sel) {
        Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
          if (!el.closest || !el.closest('#lom-onchain-currency-frame')) {
            el.style.display = 'none';
          }
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
      a.onclick = function (e) {
        e.preventDefault();
        if (window.LoMWalletGate) window.LoMWalletGate.showWarning('CA/token page will be added after launch.');
      };
    } else {
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }

    return a;
  }

  function getPayoutApiUrl() {
    if (cfg.payoutApiUrl) return String(cfg.payoutApiUrl).replace(/\/$/, '');

    var proto = window.location.protocol === 'https:' ? 'https://' : 'http://';
    return proto + window.location.hostname + ':1355';
  }

  function getInputValue(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.value) return String(el.value).trim();
      if (el && el.textContent) return String(el.textContent).trim();
    }

    return '';
  }

  function guessUsername() {
    var fromStorage = localStorage.getItem('lom_username') ||
      localStorage.getItem('username') ||
      localStorage.getItem('name');

    if (fromStorage) return fromStorage;

    return getInputValue([
      '#loginname',
      '#username',
      'input[name="username"]',
      'input[name="name"]',
      '.username'
    ]);
  }

  function guessPlayerName() {
    try {
      if (window.game && game.player && game.player.name) return game.player.name;
      if (window.player && player.name) return player.name;
    } catch (_) {}

    var fromStorage = localStorage.getItem('lom_player_name') ||
      localStorage.getItem('playerName') ||
      localStorage.getItem('playername');

    if (fromStorage) return fromStorage;

    return getInputValue([
      '#playername',
      '#playerName',
      'input[name="playername"]',
      'input[name="playerName"]',
      '.playername',
      '.playerName'
    ]);
  }

  function buildPayoutMessage(wallet, username, playerName, timestamp) {
    return [
      'Land of Nads payout',
      'wallet:' + wallet,
      'username:' + username,
      'player:' + playerName,
      'timestamp:' + timestamp
    ].join('\n');
  }

  async function ensureWalletConnected() {
    var addr = walletAddress();

    if (isAddress(addr)) return addr;

    if (window.LoMWalletGate && window.LoMWalletGate.connect) {
      var w = await window.LoMWalletGate.connect();
      if (w && w.address) return w.address;
    }

    if (window.ethereum && window.ethereum.request) {
      var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts[0]) return accounts[0];
    }

    throw new Error('Connect wallet first');
  }

  async function signPayout(wallet, username, playerName, timestamp) {
    if (!window.ethereum || !window.ethereum.request) {
      throw new Error('Wallet not found');
    }

    var message = buildPayoutMessage(wallet, username, playerName, timestamp);

    return await window.ethereum.request({
      method: 'personal_sign',
      params: [message, wallet]
    });
  }

  function setPayoutStatus(text) {
    setText('lom-payout-status', text);
  }

  async function requestPayout() {
    try {
      setPayoutStatus('Preparing payout...');

      var wallet = await ensureWalletConnected();
      var username = guessUsername();
      var playerName = guessPlayerName();

      if (!username) {
        username = prompt('Enter your game username');
      }

      if (!playerName) {
        playerName = prompt('Enter your player name');
      }

      username = String(username || '').trim().toLowerCase();
      playerName = String(playerName || '').trim();

      if (!username || !playerName) {
        setPayoutStatus('Username/player missing.');
        return;
      }

      localStorage.setItem('lom_username', username);
      localStorage.setItem('lom_player_name', playerName);

      var timestamp = Date.now();
      var signature = await signPayout(wallet, username, playerName, timestamp);

      setPayoutStatus('Sending payout request...');

      var res = await fetch(getPayoutApiUrl() + '/payout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet,
          username: username,
          playerName: playerName,
          timestamp: timestamp,
          signature: signature
        })
      });

      var data = await res.json();

      if (!data.ok) {
        setPayoutStatus('Payout failed: ' + (data.error || 'Unknown error'));
        if (window.LoMWalletGate) window.LoMWalletGate.showWarning(data.error || 'Payout failed');
        return;
      }

      setPayoutStatus('Payout sent: ' + data.paidTokens + ' ' + (cfg.tokenSymbol || '$LoN') + ' · TX ' + shortAddr(data.txHash));

      // After real payout, reset display session earned.
      sessionEarnedGold = 0;
      updateEarnedGoldUi();

      refreshBalance(true);
    } catch (err) {
      var msg = err && err.message ? err.message : 'Payout error';
      setPayoutStatus('Payout failed: ' + msg);
      if (window.LoMWalletGate) window.LoMWalletGate.showWarning(msg);
    }
  }

  function formatClaimableFromGold(gold) {
    var pointsPerToken = Number(cfg.pointsPerToken || 100);
    if (!pointsPerToken || pointsPerToken <= 0) pointsPerToken = 100;

    var tokens = gold / pointsPerToken;

    if (tokens >= 1) {
      return tokens.toFixed(2).replace(/\.?0+$/, '');
    }

    return tokens.toFixed(4).replace(/\.?0+$/, '');
  }

  function updateEarnedGoldUi() {
    var sym = cfg.tokenSymbol || '$LoN';
    var tokenEstimate = formatClaimableFromGold(sessionEarnedGold);

    var text = 'Earned this session: ' + sessionEarnedGold + ' gold ≈ ' + tokenEstimate + ' ' + sym;

    var el = document.getElementById('lom-earned-session');
    if (!el) {
      var frame = document.getElementById('lom-onchain-currency-frame');
      if (!frame) return;

      el = document.createElement('div');
      el.id = 'lom-earned-session';
      el.style.marginTop = '6px';
      el.style.fontSize = '12px';
      el.style.fontWeight = 'bold';
      frame.appendChild(el);
    }

    el.textContent = text;
  }

  function scanGoldAddedText(text) {
    if (!text) return;

    var matches = String(text).match(/(\d+)\s+gold\s+added/gi);
    if (!matches) return;

    matches.forEach(function (m) {
      var numMatch = m.match(/(\d+)/);
      if (!numMatch) return;

      var amount = parseInt(numMatch[1], 10);
      if (!Number.isFinite(amount) || amount <= 0) return;

      // avoid duplicate counting from same message spam in same second
      var shortKey = m.toLowerCase() + ':' + Math.floor(Date.now() / 1000);
      if (seenGoldMessages[shortKey]) return;
      seenGoldMessages[shortKey] = true;

      sessionEarnedGold += amount;
      updateEarnedGoldUi();
    });
  }

  function startGoldObserver() {
    if (goldObserverStarted) return;
    goldObserverStarted = true;

    updateEarnedGoldUi();

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (!node) return;

          if (node.nodeType === 3) {
            scanGoldAddedText(node.textContent);
            return;
          }

          if (node.textContent) {
            scanGoldAddedText(node.textContent);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function ensureInventoryFrame() {
    if (!cfg.showBalanceInInventory) return null;

    var existing = document.getElementById('lom-onchain-currency-frame');
    if (existing) {
      updateEarnedGoldUi();
      return existing;
    }

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
    sub.textContent = 'Wallet balance · Monad on-chain';
    frame.appendChild(sub);

    var earned = document.createElement('div');
    earned.id = 'lom-earned-session';
    earned.style.marginTop = '6px';
    earned.style.fontSize = '12px';
    earned.style.fontWeight = 'bold';
    earned.textContent = 'Earned this session: 0 gold ≈ 0 ' + (cfg.tokenSymbol || '$LoN');
    frame.appendChild(earned);

    var actions = document.createElement('div');
    actions.id = 'lom-onchain-currency-actions';

    var refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.textContent = 'Refresh';
    refresh.onclick = function (e) {
      e.preventDefault();
      refreshBalance(true);
    };
    actions.appendChild(refresh);

    var payout = document.createElement('button');
    payout.type = 'button';
    payout.textContent = 'PAYOUT';
    payout.onclick = function (e) {
      e.preventDefault();
      requestPayout();
    };
    actions.appendChild(payout);

    var ca = tokenAddress();
    var explorerHref = ca ? ((cfg.monadExplorerUrl || 'https://monadvision.com') + '/address/' + ca) : '#';
    actions.appendChild(makeAnchor(ca ? 'View CA' : 'CA soon', explorerHref, !ca));

    var nadUrl = cfg.nadFunTokenUrl || cfg.nadFunUrl || 'https://nad.fun';
    actions.appendChild(makeAnchor('nad.fun', nadUrl, false));

    frame.appendChild(actions);

    var status = document.createElement('div');
    status.id = 'lom-payout-status';
    status.style.marginTop = '6px';
    status.style.fontSize = '12px';
    status.textContent = 'Payout uses saved server gold';
    frame.appendChild(status);

    var inv = document.getElementById('allinventorywindow');
    if (inv) inv.insertBefore(frame, inv.firstChild);
    else document.body.appendChild(frame);

    updateEarnedGoldUi();

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

    updateBalanceText(sym + ': loading...', 'Wallet: ' + shortAddr(addr) + ' · checking on-chain balance');

    try {
      var balance = await readLonBalance(addr);
      updateBalanceText(sym + ': ' + balance, 'Wallet: ' + shortAddr(addr) + ' · wallet balance on-chain');

      window.dispatchEvent(new CustomEvent('lom:lon-balance', {
        detail: {
          address: addr,
          token: ca,
          balance: balance,
          symbol: sym
        }
      }));
    } catch (err) {
      updateBalanceText(sym + ': error', (err && err.message ? err.message : 'Could not read token balance'));

      if (userClicked && window.LoMWalletGate) {
        window.LoMWalletGate.showWarning('Could not read ' + sym + ' balance. Check CA/RPC.');
      }
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
      Array.prototype.forEach.call(document.querySelectorAll('body *'), function (el) {
        if (!el || el.children.length > 0) return;

        var t = (el.textContent || '').trim();

        if (t === 'GEMS' || t === 'Gems' || t === 'Gold' || t === 'GOLD') {
          el.textContent = cfg.tokenSymbol || '$LoN';
        }
      });
    } catch (_) {}
  }

  function init() {
    hideOldCurrency();
    ensureInventoryFrame();
    patchInventorySetCurrency();
    patchKnownGoldTexts();
    refreshBalance(false);
    startGoldObserver();

    if (timer) clearInterval(timer);

    timer = setInterval(function () {
      hideOldCurrency();
      ensureInventoryFrame();
      patchInventorySetCurrency();
      refreshBalance(false);
      updateEarnedGoldUi();
    }, Number(cfg.refreshBalanceMs || 15000));
  }

  window.LoMMonadCurrency = {
    refresh: refreshBalance,
    readBalance: readLonBalance,
    hideOldCurrency: hideOldCurrency,
    ensureInventoryFrame: ensureInventoryFrame,
    requestPayout: requestPayout,
    getSessionEarnedGold: function () {
      return sessionEarnedGold;
    },
    resetSessionEarnedGold: function () {
      sessionEarnedGold = 0;
      updateEarnedGoldUi();
    },
    getLastBalanceText: function () {
      return lastBalanceText;
    }
  };

  window.addEventListener('lom:wallet-connected', function () {
    refreshBalance(false);
  });

  window.addEventListener('lom:wallet-disconnected', function () {
    refreshBalance(false);
  });

  window.addEventListener('lom:chain-changed', function () {
    refreshBalance(false);
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refreshBalance(false);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
