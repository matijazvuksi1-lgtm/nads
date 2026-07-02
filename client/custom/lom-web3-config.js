// Land of Mana Monad / $LoN config. Edit this file later.
// CA can stay empty until your nad.fun launch. After launch paste the token CA below.
window.LOM_WEB3_CONFIG = {
  projectName: 'Land Of Nads',

  // Put your real links here.
  xLink: 'https://x.com/landofnads',
  telegramLink: 'https://t.me/landofnads',

  // nad.fun launch/token page. Leave token URL empty until you have the final page.
  nadFunUrl: 'https://nad.fun',
  nadFunTokenUrl: 'https://nad.fun/tokens/0x53Bc12b090CfC365E7394d1cC745F8ac04117777',

  // $LoN token. Paste CA here after launch.
  tokenSymbol: '$LoN',
  tokenName: 'Land of Nads',
  tokenAddress: '0x53Bc12b090CfC365E7394d1cC745F8ac04117777',
  contractAddress: '0x53Bc12b090CfC365E7394d1cC745F8ac04117777',
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
