(function () {
  'use strict';

  if (window.LoMWalletGateLoaded) return;
  window.LoMWalletGateLoaded = true;

  var cfg = Object.assign({
    projectName: 'Land Of Nads',
    xLink: 'https://x.com/landofnads',
    telegramLink: 'https://t.me/landofnads',
    nadFunUrl: 'https://nad.fun',
    nadFunTokenUrl: 'https://nad.fun/tokens/0x53Bc12b090CfC365E7394d1cC745F8ac04117777',
    contractAddress: '0x53Bc12b090CfC365E7394d1cC745F8ac04117777',
    tokenAddress: '0x53Bc12b090CfC365E7394d1cC745F8ac04117777',
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

  var activeProvider = null;
  var activeWallet = null;

  function isEvmAddress(addr) {
    return /^0x[a-fA-F0-9]{40}$/.test(String(addr || ''));
  }

  function shortAddr(addr) {
    if (!addr || addr.length < 10) return addr || '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  function providerName(provider) {
    if (!provider) return 'Unknown';
    if (provider.isPhantom) return 'Phantom';
    if (provider.isMetaMask) return 'MetaMask';
    if (provider.isRabby) return 'Rabby';
    if (provider.isOkxWallet || provider.isOKExWallet) return 'OKX';
    if (provider.isCoinbaseWallet) return 'Coinbase';
    if (provider.isTrust) return 'Trust Wallet';
    return 'EVM Wallet';
  }

  function addUnique(list, provider) {
    if (!provider || !provider.request) return;
    if (list.indexOf(provider) === -1) list.push(provider);
  }

  function getAllProviders() {
    var list = [];

    try {
      if (window.phantom && window.phantom.ethereum) addUnique(list, window.phantom.ethereum);
    } catch (_) {}

    try {
      if (window.ethereum) {
        if (window.ethereum.providers && window.ethereum.providers.length) {
          window.ethereum.providers.forEach(function (p) { addUnique(list, p); });
        } else {
          addUnique(list, window.ethereum);
        }
      }
    } catch (_) {}

    return list;
  }

  function waitForProviders(timeoutMs) {
    timeoutMs = timeoutMs || 6000;
    return new Promise(function (resolve) {
      var started = Date.now();
      function check() {
        var providers = getAllProviders();
        if (providers.length || Date.now() - started >= timeoutMs) {
          resolve(providers);
          return;
        }
        setTimeout(check, 150);
      }
      check();
    });
  }

  function pickPreferredProvider(providers, preferWallet) {
    preferWallet = String(preferWallet || '').toLowerCase();

    if (preferWallet) {
      var named = providers.find(function (p) {
        var n = providerName(p).toLowerCase();
        return n === preferWallet || n.indexOf(preferWallet) >= 0;
      });
      if (named) return named;
    }

    var phantom = providers.find(function (p) { return p && p.isPhantom; });
    if (phantom) return phantom;

    var meta = providers.find(function (p) { return p && p.isMetaMask; });
    if (meta) return meta;

    return providers[0] || null;
  }

  function showWarning(msg) {
    var old = document.getElementById('lom-wallet-warning');
    if (old) old.remove();

    var el = document.createElement('div');
    el.id = 'lom-wallet-warning';
    el.textContent = msg || 'Connect wallet first.';
    document.body.appendChild(el);

    setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 4500);
  }

  function getWallet() {
    if (activeWallet && isEvmAddress(activeWallet.address)) return activeWallet;
    return null;
  }

  function hasWallet() {
    return !!getWallet();
  }

  function statusText() {
    var w = getWallet();
    if (w && w.address) return '✅ ' + shortAddr(w.address);
    return 'Wallet required';
  }

  function saveWalletRuntime(data) {
    activeWallet = data;
    window.dispatchEvent(new CustomEvent('lom:wallet-connected', { detail: data }));
    updatePanel();
  }

  function clearWallet() {
    activeWallet = null;
    activeProvider = null;
    try { localStorage.removeItem('lom_connected_wallet_v2_monad'); } catch (_) {}
    updatePanel();
    window.dispatchEvent(new Event('lom:wallet-disconnected'));
  }

  async function ensureMonadNetwork(provider) {
    provider = provider || activeProvider;

    if (!provider || !provider.request) {
      showWarning('No EVM wallet found. Unlock Phantom/MetaMask and refresh.');
      return false;
    }

    try {
      var chainId = await provider.request({ method: 'eth_chainId' });
      if ((chainId || '').toLowerCase() === (cfg.monadChainIdHex || '0x8f').toLowerCase()) return true;

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: cfg.monadChainIdHex || '0x8f' }]
        });
        return true;
      } catch (switchErr) {
        if (
          switchErr &&
          (
            switchErr.code === 4902 ||
            String(switchErr.message || '').indexOf('Unrecognized') >= 0 ||
            String(switchErr.message || '').indexOf('not been added') >= 0
          )
        ) {
          await provider.request({
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

  function makeWalletChoice(providers) {
    return new Promise(function (resolve) {
      if (!providers || providers.length <= 1) {
        resolve(providers && providers[0] ? providers[0] : null);
        return;
      }

      var old = document.getElementById('lom-wallet-picker');
      if (old) old.remove();

      var box = document.createElement('div');
      box.id = 'lom-wallet-picker';
      box.style.position = 'fixed';
      box.style.left = '50%';
      box.style.top = '50%';
      box.style.transform = 'translate(-50%, -50%)';
      box.style.zIndex = '999999';
      box.style.background = 'rgba(10, 20, 35, 0.96)';
      box.style.border = '2px solid #f0c15a';
      box.style.borderRadius = '12px';
      box.style.padding = '18px';
      box.style.color = '#fff';
      box.style.fontFamily = 'Arial, sans-serif';
      box.style.minWidth = '260px';
      box.style.textAlign = 'center';
      box.style.boxShadow = '0 0 30px rgba(0,0,0,0.55)';

      var title = document.createElement('div');
      title.textContent = 'Choose wallet';
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '12px';
      title.style.fontSize = '18px';
      box.appendChild(title);

      providers.forEach(function (provider) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = providerName(provider);
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.margin = '8px 0';
        btn.style.padding = '10px';
        btn.style.borderRadius = '8px';
        btn.style.border = '0';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = 'bold';
        btn.style.background = '#d9b44a';
        btn.style.color = '#172033';
        btn.onclick = function () {
          box.remove();
          resolve(provider);
        };
        box.appendChild(btn);
      });

      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.style.display = 'block';
      cancel.style.width = '100%';
      cancel.style.margin = '12px 0 0';
      cancel.style.padding = '8px';
      cancel.style.borderRadius = '8px';
      cancel.style.border = '0';
      cancel.style.cursor = 'pointer';
      cancel.style.background = '#39465f';
      cancel.style.color = '#fff';
      cancel.onclick = function () {
        box.remove();
        resolve(null);
      };
      box.appendChild(cancel);

      document.body.appendChild(box);
    });
  }

  async function connectWallet(preferWallet) {
    var providers = await waitForProviders(6000);

    if (!providers.length) {
      showWarning('Wallet not detected. Unlock Phantom/MetaMask, allow this site, then refresh.');
      console.log('Wallet debug:', {
        ethereum: !!window.ethereum,
        phantom: !!window.phantom,
        phantomEthereum: !!(window.phantom && window.phantom.ethereum),
        providers: window.ethereum && window.ethereum.providers ? window.ethereum.providers.length : 0
      });
      return null;
    }

    try {
      var provider = preferWallet ? pickPreferredProvider(providers, preferWallet) : await makeWalletChoice(providers);
      if (!provider) return null;

      activeProvider = provider;

      var accounts = await provider.request({ method: 'eth_requestAccounts' });
      var address = accounts && accounts[0];

      if (!address) throw new Error('No wallet selected');
      if (!isEvmAddress(address)) throw new Error('Wrong wallet type. Use EVM address starting with 0x.');

      await ensureMonadNetwork(provider);

      var payload = {
        address: address,
        connectedAt: new Date().toISOString(),
        host: location.host,
        chainId: cfg.monadChainIdHex || '0x8f',
        walletName: providerName(provider),
        realConnected: true
      };

      if (cfg.askSignatureAfterConnect) {
        var message =
          cfg.projectName + ' wallet verification\n' +
          'Domain: ' + location.host + '\n' +
          'Wallet: ' + address + '\n' +
          'Time: ' + payload.connectedAt + '\n' +
          'Only sign this if you trust this website.';

        try {
          payload.message = message;
          payload.signature = await provider.request({
            method: 'personal_sign',
            params: [message, address]
          });
        } catch (sigErr) {
          payload.signatureRejected = true;
        }
      }

      saveWalletRuntime(payload);
      return payload;
    } catch (err) {
      showWarning('Wallet connect failed: ' + (err && err.message ? err.message : err));
      return null;
    }
  }

  async function signMessage(message, address) {
    var w = getWallet();
    var provider = activeProvider;

    if (!provider || !provider.request || !w) {
      w = await connectWallet();
      provider = activeProvider;
    }

    if (!provider || !provider.request || !w) throw new Error('Wallet not connected');

    var wallet = address || w.address;
    return await provider.request({
      method: 'personal_sign',
      params: [message, wallet]
    });
  }

  async function request(method, params) {
    var provider = activeProvider;
    if (!provider || !provider.request) {
      var w = await connectWallet();
      provider = activeProvider;
      if (!w || !provider) throw new Error('Wallet not connected');
    }
    return await provider.request({ method: method, params: params || [] });
  }

  function makeLink(label, href, disabled, onDisabledMsg) {
    var a = document.createElement('a');
    a.textContent = label;

    if (disabled) {
      a.href = '#';
      a.className = 'is-disabled';
      a.onclick = function (e) {
        e.preventDefault();
        showWarning(onDisabledMsg || 'Coming soon.');
      };
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

    panel.appendChild(makeLink('X', cfg.xLink || '#', !cfg.xLink, 'Add X link in config.'));
    panel.appendChild(makeLink('Telegram', cfg.telegramLink || '#', !cfg.telegramLink, 'Add Telegram link in config.'));

    var nadUrl = cfg.nadFunTokenUrl || cfg.nadFunUrl || 'https://nad.fun';
    panel.appendChild(makeLink('nad.fun', nadUrl, false));

    var ca = getTokenAddress();
    var caText = ca ? ('CA: ' + shortAddr(ca)) : 'CA soon';
    var caHref = ca ? ((cfg.monadExplorerUrl || 'https://monadvision.com') + '/address/' + ca) : '#';
    panel.appendChild(makeLink(caText, caHref, !ca, 'CA missing.'));

    var walletBtn = document.createElement('button');
    walletBtn.id = 'lom-connect-wallet-btn';
    walletBtn.type = 'button';
    walletBtn.textContent = hasWallet() ? 'Change wallet' : 'Connect Wallet';
    walletBtn.onclick = function (e) {
      e.preventDefault();
      connectWallet();
    };
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
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    } catch (_) {
      return false;
    }

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

  function bindProviderEvents(provider) {
    if (!provider || !provider.on || provider._lomBound) return;
    provider._lomBound = true;

    provider.on('accountsChanged', function (accounts) {
      if (accounts && accounts[0] && isEvmAddress(accounts[0])) {
        activeProvider = provider;
        saveWalletRuntime({
          address: accounts[0],
          connectedAt: new Date().toISOString(),
          host: location.host,
          chainId: cfg.monadChainIdHex || '0x8f',
          walletName: providerName(provider),
          realConnected: true
        });
      } else {
        clearWallet();
      }
    });

    provider.on('chainChanged', function () {
      window.dispatchEvent(new Event('lom:chain-changed'));
    });
  }

  async function bindAllProviders() {
    var providers = await waitForProviders(6000);
    providers.forEach(bindProviderEvents);
    console.log('LoN wallet providers found:', providers.map(providerName));
  }

  async function autoDetectConnectedWallet() {
    var providers = await waitForProviders(6000);

    for (var i = 0; i < providers.length; i++) {
      var provider = providers[i];
      try {
        var accounts = await provider.request({ method: 'eth_accounts' });
        if (accounts && accounts[0] && isEvmAddress(accounts[0])) {
          activeProvider = provider;
          saveWalletRuntime({
            address: accounts[0],
            connectedAt: new Date().toISOString(),
            host: location.host,
            chainId: cfg.monadChainIdHex || '0x8f',
            walletName: providerName(provider),
            realConnected: true
          });
          return;
        }
      } catch (_) {}
    }

    clearWallet();
  }

  function init() {
    try { localStorage.removeItem('lom_connected_wallet_v2_monad'); } catch (_) {}

    buildPanel();
    updatePanel();

    document.addEventListener('click', guardEvent, true);
    document.addEventListener('mousedown', guardEvent, true);
    document.addEventListener('touchstart', guardEvent, true);
    document.addEventListener('submit', guardSubmit, true);

    bindAllProviders();
    autoDetectConnectedWallet();
  }

  window.LoMWalletGate = {
    connect: connectWallet,
    ensureMonadNetwork: ensureMonadNetwork,
    hasWallet: hasWallet,
    getWallet: getWallet,
    getProvider: function () { return activeProvider; },
    getAllProviders: getAllProviders,
    request: request,
    signMessage: signMessage,
    getTokenAddress: getTokenAddress,
    disconnectLocal: clearWallet,
    showWarning: showWarning,
    shortAddr: shortAddr
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
