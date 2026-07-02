(function () {
  'use strict';

  if (window.LoMWalletGateLoaded) return;
  window.LoMWalletGateLoaded = true;

  var cfg = Object.assign({
    projectName: 'Land Of Nads',
    xLink: 'https://x.com/landofnads',
    telegramLink: 'https://t.me/landofnads',
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
        var message = cfg.projectName + ' wallet verification\n' +
          'Domain: ' + location.host + '\n' +
          'Wallet: ' + address + '\n' +
          'Time: ' + payload.connectedAt + '\n' +
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
        .filter(Boolean).join(' ').replace(/s+/g, ' ').trim().toUpperCase();
    } catch (_) { return false; }

    if (cfg.requireWalletForRegister && /(^|)REGISTER(|$)/.test(text)) return true;
    if (cfg.requireWalletForLogin && /(^|)LOGIN(|$)/.test(text)) return true;
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
