#!/usr/bin/env node
/*
  Land of Mana Monad $LoN Currency patcher
  Run from the ROOT of your cloned/extracted landofmana repo.

  What it does:
  - Adds ONE non-duplicated wallet/social/Nad.fun menu overlay to client/index.html
  - Adds an on-chain $LoN balance panel inside the Inventory window
  - Hides old gold/gems inventory currency UI and overrides InventoryDialog.setCurrency on the client
  - Reads ERC-20 balanceOf(wallet) on Monad mainnet after wallet connect
  - CA/token address can stay empty until nad.fun launch
  - Makes backups before changing existing files
*/

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const clientIndex = path.join(root, 'client', 'index.html');
const customDir = path.join(root, 'client', 'custom');

const oldMarkerStart = '<!-- LoM Web3 Wallet + Social Links START -->';
const oldMarkerEnd = '<!-- LoM Web3 Wallet + Social Links END -->';
const markerStart = '<!-- LoM Monad Wallet + $LoN Currency START -->';
const markerEnd = '<!-- LoM Monad Wallet + $LoN Currency END -->';

const configJs = `// Land of Mana Monad / $LoN config. Edit this file later.
// CA can stay empty until your nad.fun launch. After launch paste the token CA below.
window.LOM_WEB3_CONFIG = {
  projectName: 'Land Of Mana',

  // Put your real links here.
  xLink: 'https://x.com/YOUR_X_LINK_HERE',
  telegramLink: 'https://t.me/YOUR_TELEGRAM_LINK_HERE',

  // nad.fun launch/token page. Leave token URL empty until you have the final page.
  nadFunUrl: 'https://nad.fun',
  nadFunTokenUrl: '',

  // $LoN token. Paste CA here after launch.
  tokenSymbol: '$LoN',
  tokenName: 'Land of Mana',
  tokenAddress: '',
  contractAddress: '',
  tokenDecimals: 18,

  // Monad mainnet.
  monadChainId: 143,
  monadChainIdHex: '0x8f',
  monadNetworkName: 'Monad Mainnet',
  monadRpcUrl: 'https://rpc.monad.xyz',
  monadExplorerUrl: 'https://monadvision.com',
  nativeCurrencyName: 'MON',
  nativeCurrencySymbol: 'MON',
  nativeCurrencyDecimals: 18,

  // Wallet gate.
  requireWalletForRegister: true,
  requireWalletForLogin: true,
  askSignatureAfterConnect: true,

  // Currency behavior.
  replaceOldCurrencyUi: true,
  showBalanceInInventory: true,
  refreshBalanceMs: 15000
};
`;

const css = `/* Land of Mana Monad wallet + $LoN currency patch */
#lom-web3-panel {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 999999;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  max-width: calc(100vw - 28px);
  padding: 10px 12px;
  border: 2px solid #1d2a46;
  border-radius: 12px;
  background: rgba(8, 30, 68, 0.86);
  box-shadow: 0 6px 0 rgba(0,0,0,0.35);
  color: #fff;
  font-family: Arial, sans-serif;
  font-size: 13px;
  user-select: none;
}
#lom-web3-panel a,
#lom-web3-panel button,
#lom-onchain-currency-frame a,
#lom-onchain-currency-frame button {
  border: 2px solid #28324f;
  border-radius: 9px;
  background: #c39a3b;
  color: #fff;
  min-height: 34px;
  padding: 7px 11px;
  font-weight: 800;
  font-size: 13px;
  line-height: 1;
  text-decoration: none;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.45);
  cursor: pointer;
}
#lom-web3-panel a:hover,
#lom-web3-panel button:hover,
#lom-onchain-currency-frame a:hover,
#lom-onchain-currency-frame button:hover { filter: brightness(1.08); }
#lom-web3-panel button:disabled,
#lom-web3-panel a.is-disabled,
#lom-onchain-currency-frame a.is-disabled { opacity: 0.55; cursor: not-allowed; filter: grayscale(0.3); }
#lom-wallet-status,
#lom-lon-top-balance {
  min-width: 126px;
  text-align: center;
  padding: 7px 9px;
  border-radius: 9px;
  border: 2px solid #28324f;
  background: rgba(0,0,0,0.24);
  font-weight: 800;
}
#lom-wallet-warning {
  position: fixed;
  left: 50%;
  top: 24px;
  transform: translateX(-50%);
  z-index: 1000000;
  max-width: calc(100vw - 40px);
  padding: 12px 16px;
  border: 2px solid #28324f;
  border-radius: 10px;
  background: #c0392b;
  color: #fff;
  font-family: Arial, sans-serif;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 6px 0 rgba(0,0,0,0.35);
}
body.lom-onchain-currency .inventoryGoldFrame,
body.lom-onchain-currency .inventoryGemsFrame,
body.lom-onchain-currency .inventorySellGoldFrame {
  display: none !important;
}
#lom-onchain-currency-frame {
  position: relative;
  z-index: 1000;
  display: block;
  width: calc(100% - 24px);
  max-width: 360px;
  margin: 8px auto 10px auto;
  padding: 9px 10px;
  border: 2px solid #1d2a46;
  border-radius: 12px;
  background: rgba(8, 30, 68, 0.90);
  color: #fff;
  font-family: Arial, sans-serif;
  text-align: center;
  box-shadow: 0 4px 0 rgba(0,0,0,0.35);
}
#lom-onchain-currency-title { font-size: 14px; font-weight: 900; margin-bottom: 3px; }
#lom-lon-balance { font-size: 18px; font-weight: 900; margin: 4px 0 6px 0; }
#lom-lon-sub { opacity: 0.9; font-size: 12px; margin-bottom: 8px; }
#lom-onchain-currency-actions { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
#lom-onchain-currency-frame button,
#lom-onchain-currency-frame a { min-height: 28px; padding: 5px 8px; font-size: 12px; }
@media (max-width: 620px) {
  #lom-web3-panel { bottom: 8px; padding: 8px; gap: 6px; }
  #lom-web3-panel a, #lom-web3-panel button, #lom-wallet-status, #lom-lon-top-balance { font-size: 12px; min-height: 30px; padding: 6px 8px; }
}
`;

const web3Js = `(function () {
  'use strict';

  if (window.LoMWalletGateLoaded) return;
  window.LoMWalletGateLoaded = true;

  var cfg = Object.assign({
    projectName: 'Land Of Mana',
    xLink: 'https://x.com/YOUR_X_LINK_HERE',
    telegramLink: 'https://t.me/YOUR_TELEGRAM_LINK_HERE',
    nadFunUrl: 'https://nad.fun',
    nadFunTokenUrl: '',
    contractAddress: '',
    tokenAddress: '',
    tokenSymbol: '$LoN',
    monadChainIdHex: '0x8f',
    monadNetworkName: 'Monad Mainnet',
    monadRpcUrl: 'https://rpc.monad.xyz',
    monadExplorerUrl: 'https://monadvision.com',
    nativeCurrencyName: 'MON',
    nativeCurrencySymbol: 'MON',
    nativeCurrencyDecimals: 18,
    requireWalletForRegister: true,
    requireWalletForLogin: true,
    askSignatureAfterConnect: true
  }, window.LOM_WEB3_CONFIG || {});

  var STORAGE_KEY = 'lom_connected_wallet_v2_monad';

  function shortAddr(addr) {
    if (!addr || addr.length < 10) return addr || '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  function getSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { return null; }
  }

  function saveWallet(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('lom:wallet-connected', { detail: data }));
  }

  function clearWallet() {
    localStorage.removeItem(STORAGE_KEY);
    updatePanel();
    window.dispatchEvent(new Event('lom:wallet-disconnected'));
  }

  function hasWallet() {
    var saved = getSaved();
    return !!(saved && /^0x[a-fA-F0-9]{40}$/.test(saved.address || ''));
  }

  function statusText() {
    var saved = getSaved();
    return saved && saved.address ? ('✅ ' + shortAddr(saved.address)) : 'Wallet required';
  }

  function showWarning(msg) {
    var old = document.getElementById('lom-wallet-warning');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'lom-wallet-warning';
    el.textContent = msg || 'Connect wallet first.';
    document.body.appendChild(el);
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 3500);
  }

  async function ensureMonadNetwork() {
    if (!window.ethereum || !window.ethereum.request) return false;
    try {
      var chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if ((chainId || '').toLowerCase() === (cfg.monadChainIdHex || '0x8f').toLowerCase()) return true;
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: cfg.monadChainIdHex || '0x8f' }] });
        return true;
      } catch (switchErr) {
        if (switchErr && (switchErr.code === 4902 || String(switchErr.message || '').indexOf('Unrecognized') >= 0)) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: cfg.monadChainIdHex || '0x8f',
              chainName: cfg.monadNetworkName || 'Monad Mainnet',
              nativeCurrency: {
                name: cfg.nativeCurrencyName || 'MON',
                symbol: cfg.nativeCurrencySymbol || 'MON',
                decimals: cfg.nativeCurrencyDecimals || 18
              },
              rpcUrls: [cfg.monadRpcUrl || 'https://rpc.monad.xyz'],
              blockExplorerUrls: [cfg.monadExplorerUrl || 'https://monadvision.com']
            }]
          });
          return true;
        }
        throw switchErr;
      }
    } catch (err) {
      showWarning('Please switch wallet to Monad Mainnet.');
      return false;
    }
  }

  async function connectWallet() {
    if (!window.ethereum || !window.ethereum.request) {
      showWarning('No wallet found. Install MetaMask or Rabby, then refresh.');
      window.open('https://metamask.io/download/', '_blank', 'noopener,noreferrer');
      return null;
    }

    try {
      var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      var address = accounts && accounts[0];
      if (!address) throw new Error('No wallet selected');
      await ensureMonadNetwork();

      var payload = {
        address: address,
        connectedAt: new Date().toISOString(),
        host: location.host,
        chainId: cfg.monadChainIdHex || '0x8f'
      };

      if (cfg.askSignatureAfterConnect) {
        var message = cfg.projectName + ' wallet verification\\n' +
          'Domain: ' + location.host + '\\n' +
          'Wallet: ' + address + '\\n' +
          'Time: ' + payload.connectedAt + '\\n' +
          'Only sign this if you trust this website.';
        try {
          payload.message = message;
          payload.signature = await window.ethereum.request({ method: 'personal_sign', params: [message, address] });
        } catch (sigErr) {
          payload.signatureRejected = true;
        }
      }

      saveWallet(payload);
      updatePanel();
      return payload;
    } catch (err) {
      showWarning('Wallet connect failed: ' + (err && err.message ? err.message : err));
      return null;
    }
  }

  function makeLink(label, href, disabled, onDisabledMsg) {
    var a = document.createElement('a');
    a.textContent = label;
    if (disabled) {
      a.href = '#';
      a.className = 'is-disabled';
      a.addEventListener('click', function (e) { e.preventDefault(); showWarning(onDisabledMsg || 'Coming soon.'); });
    } else {
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  }

  function getTokenAddress() {
    return cfg.tokenAddress || cfg.contractAddress || '';
  }

  function buildPanel() {
    if (document.getElementById('lom-web3-panel')) return;
    var panel = document.createElement('div');
    panel.id = 'lom-web3-panel';

    panel.appendChild(makeLink('𝕏 X', cfg.xLink || '#', !cfg.xLink || /YOUR_X_LINK_HERE/i.test(cfg.xLink), 'Add X link in client/custom/lom-web3-config.js'));
    panel.appendChild(makeLink('Telegram', cfg.telegramLink || '#', !cfg.telegramLink || /YOUR_TELEGRAM_LINK_HERE/i.test(cfg.telegramLink), 'Add Telegram link in client/custom/lom-web3-config.js'));

    var nadUrl = cfg.nadFunTokenUrl || cfg.nadFunUrl || 'https://nad.fun';
    panel.appendChild(makeLink('nad.fun', nadUrl, false));

    var ca = getTokenAddress();
    var caText = ca ? ('CA: ' + shortAddr(ca)) : 'CA soon';
    var caHref = ca ? ((cfg.monadExplorerUrl || 'https://monadvision.com') + '/address/' + ca) : '#';
    panel.appendChild(makeLink(caText, caHref, !ca, 'CA will be added after nad.fun launch.'));

    var walletBtn = document.createElement('button');
    walletBtn.id = 'lom-connect-wallet-btn';
    walletBtn.type = 'button';
    walletBtn.textContent = hasWallet() ? 'Change wallet' : 'Connect Wallet';
    walletBtn.addEventListener('click', function (e) { e.preventDefault(); connectWallet(); });
    panel.appendChild(walletBtn);

    var status = document.createElement('span');
    status.id = 'lom-wallet-status';
    status.textContent = statusText();
    panel.appendChild(status);

    var bal = document.createElement('span');
    bal.id = 'lom-lon-top-balance';
    bal.textContent = (cfg.tokenSymbol || '$LoN') + ': --';
    panel.appendChild(bal);

    document.body.appendChild(panel);
  }

  function updatePanel() {
    var status = document.getElementById('lom-wallet-status');
    var btn = document.getElementById('lom-connect-wallet-btn');
    if (status) status.textContent = statusText();
    if (btn) btn.textContent = hasWallet() ? 'Change wallet' : 'Connect Wallet';
  }

  function isBlockedAction(el) {
    if (!el) return false;
    var text = '';
    try {
      text = [el.textContent, el.value, el.getAttribute && el.getAttribute('aria-label'), el.id, el.className]
        .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toUpperCase();
    } catch (_) { return false; }

    if (cfg.requireWalletForRegister && /(^|\b)REGISTER(\b|$)/.test(text)) return true;
    if (cfg.requireWalletForLogin && /(^|\b)LOGIN(\b|$)/.test(text)) return true;
    return false;
  }

  function guardEvent(e) {
    if (hasWallet()) return;
    var el = e.target;
    var depth = 0;
    while (el && el !== document && depth < 6) {
      if (isBlockedAction(el)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        showWarning('Connect wallet first, then continue.');
        connectWallet();
        return false;
      }
      el = el.parentNode;
      depth++;
    }
  }

  function guardSubmit(e) {
    if (hasWallet()) return;
    var formText = (e.target && e.target.textContent || '').toUpperCase();
    if (/REGISTER|LOGIN/.test(formText)) {
      e.preventDefault();
      e.stopPropagation();
      showWarning('Connect wallet first, then continue.');
      connectWallet();
      return false;
    }
  }

  function init() {
    buildPanel();
    updatePanel();
    document.addEventListener('click', guardEvent, true);
    document.addEventListener('mousedown', guardEvent, true);
    document.addEventListener('touchstart', guardEvent, true);
    document.addEventListener('submit', guardSubmit, true);

    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on('accountsChanged', function (accounts) {
        if (accounts && accounts[0]) saveWallet(Object.assign(getSaved() || {}, { address: accounts[0], connectedAt: new Date().toISOString(), host: location.host }));
        else clearWallet();
        updatePanel();
      });
      window.ethereum.on('chainChanged', function () { window.dispatchEvent(new Event('lom:chain-changed')); });
      window.ethereum.request({ method: 'eth_accounts' }).then(function (accounts) {
        if (accounts && accounts[0] && !hasWallet()) {
          saveWallet({ address: accounts[0], connectedAt: new Date().toISOString(), host: location.host });
          updatePanel();
        }
      }).catch(function () {});
    }
  }

  window.LoMWalletGate = {
    connect: connectWallet,
    ensureMonadNetwork: ensureMonadNetwork,
    hasWallet: hasWallet,
    getWallet: getSaved,
    getTokenAddress: getTokenAddress,
    disconnectLocal: clearWallet,
    showWarning: showWarning,
    shortAddr: shortAddr
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
`;

const currencyJs = `(function () {
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
    var wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
`;

const injectBlock = `${markerStart}
<link rel="stylesheet" href="custom/lom-web3.css">
<script src="custom/lom-web3-config.js"></script>
<script src="custom/lom-web3.js" defer></script>
<script src="custom/lom-monad-currency.js" defer></script>
${markerEnd}`;

function die(msg) {
  console.error('\n❌ ' + msg + '\n');
  process.exit(1);
}

function ensureRepo() {
  if (!fs.existsSync(clientIndex)) {
    die('Run this from the landofmana repo root. I cannot find client/index.html here: ' + clientIndex);
  }
}

function backup(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = file + '.backup-' + stamp;
  fs.copyFileSync(file, out);
  return out;
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function removeBlock(html, start, end) {
  const re = new RegExp(escRe(start) + '[\\s\\S]*?' + escRe(end) + '\\n?', 'gi');
  return html.replace(re, '');
}

function removeOldInjection(html) {
  html = removeBlock(html, oldMarkerStart, oldMarkerEnd);
  html = removeBlock(html, markerStart, markerEnd);
  // Remove any accidental direct duplicate custom script/link refs from earlier manual edits.
  html = html.replace(/\s*<link[^>]+href=["']custom\/lom-web3\.css["'][^>]*>\s*/gi, '\n');
  html = html.replace(/\s*<script[^>]+src=["']custom\/lom-web3-config\.js["'][^>]*><\/script>\s*/gi, '\n');
  html = html.replace(/\s*<script[^>]+src=["']custom\/lom-web3\.js["'][^>]*><\/script>\s*/gi, '\n');
  html = html.replace(/\s*<script[^>]+src=["']custom\/lom-monad-currency\.js["'][^>]*><\/script>\s*/gi, '\n');
  return html;
}

function injectIndex() {
  let html = fs.readFileSync(clientIndex, 'utf8');
  const original = html;
  html = removeOldInjection(html);

  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, injectBlock + '\n</head>');
  } else if (/<body[^>]*>/i.test(html)) {
    html = html.replace(/<body[^>]*>/i, (m) => m + '\n' + injectBlock);
  } else {
    html = injectBlock + '\n' + html;
  }

  if (html !== original) backup(clientIndex);
  fs.writeFileSync(clientIndex, html, 'utf8');
}

function writeCustomFiles() {
  fs.mkdirSync(customDir, { recursive: true });
  const files = {
    'lom-web3-config.js': configJs,
    'lom-web3.css': css,
    'lom-web3.js': web3Js,
    'lom-monad-currency.js': currencyJs
  };
  for (const [name, data] of Object.entries(files)) {
    const file = path.join(customDir, name);
    if (fs.existsSync(file)) backup(file);
    fs.writeFileSync(file, data, 'utf8');
  }
}

const textExt = new Set(['.html', '.htm', '.js', '.ts', '.css', '.md', '.json', '.txt', '.yml', '.yaml', '.xml']);
const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.cache']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function cleanLandOfNadsSwitchText() {
  let changed = 0;
  let removedLines = 0;
  for (const file of walk(root)) {
    const ext = path.extname(file).toLowerCase();
    if (!textExt.has(ext)) continue;
    if (/\.backup-\d{4}-\d{2}-\d{2}T/.test(file)) continue;
    let txt;
    try { txt = fs.readFileSync(file, 'utf8'); } catch (_) { continue; }
    const lines = txt.split(/\r?\n/);
    const kept = lines.filter((line) => {
      const bad = /land\s*of\s*nads|landofnads/i.test(line) && /switch/i.test(line);
      if (bad) removedLines++;
      return !bad;
    });
    const out = kept.join('\n');
    if (out !== txt) {
      backup(file);
      fs.writeFileSync(file, out, 'utf8');
      changed++;
    }
  }
  return { changed, removedLines };
}

function duplicateCheck() {
  const html = fs.readFileSync(clientIndex, 'utf8');
  const starts = (html.match(new RegExp(escRe(markerStart), 'g')) || []).length;
  const walletScripts = (html.match(/custom\/lom-web3\.js/g) || []).length;
  const currencyScripts = (html.match(/custom\/lom-monad-currency\.js/g) || []).length;
  if (starts !== 1 || walletScripts !== 1 || currencyScripts !== 1) {
    die('Duplicate check failed. Injection starts=' + starts + ', wallet refs=' + walletScripts + ', currency refs=' + currencyScripts);
  }
}

function main() {
  ensureRepo();
  writeCustomFiles();
  injectIndex();
  const clean = cleanLandOfNadsSwitchText();
  duplicateCheck();
  console.log('\n✅ Land of Mana Monad $LoN currency patch applied.');
  console.log('✅ Wallet connect still required before REGISTER / LOGIN.');
  console.log('✅ Added ONE clean menu: X, Telegram, nad.fun, CA, Wallet, $LoN balance.');
  console.log('✅ Added $LoN on-chain balance panel inside Inventory.');
  console.log('✅ Old visible inventory Gold/Gems UI is hidden and client setCurrency is overridden.');
  console.log(`✅ Removed ${clean.removedLines} LandOfNads switch text line(s) from ${clean.changed} file(s).`);
  console.log('\nNext: after nad.fun launch, edit client/custom/lom-web3-config.js and paste tokenAddress / contractAddress.');
}

main();
