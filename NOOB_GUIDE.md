# Land of Mana Monad $LoN Currency Modpack — Windows Noob Guide

This is the new **Windows .bat** modpack for your Land of Mana folder.

## What it does

- Keeps wallet connect before REGISTER / LOGIN.
- Adds X, Telegram, nad.fun, CA, Wallet and `$LoN` balance on the first menu.
- Adds `$LoN` balance inside the Inventory window.
- Hides the old visible Gold/Gems inventory UI.
- Overrides the client-side `setCurrency(gold, gems)` so old Gold/Gems do not keep showing.
- Reads real ERC-20 `balanceOf(wallet)` from Monad mainnet.
- No duplicate menu/windows/scripts if you run the patch again.
- CA can stay empty until nad.fun launch.

## 1) Put files in the game folder

Copy everything from this ZIP into your main `landofmana` folder.

Correct folder should contain:

```text
client
gameserver
userserver
gameserver-win.bat
userserver-win.bat
START HERE WINDOWS.bat
```

## 2) Run patch

Double click:

```text
START HERE WINDOWS.bat
```

It will patch the game and ask if you want to start the client.

## 3) After nad.fun launch, add CA

Open:

```text
client\custom\lom-web3-config.js
```

Find:

```js
tokenAddress: '',
contractAddress: '',
```

Paste your token CA:

```js
tokenAddress: '0xYOUR_LON_CA_HERE',
contractAddress: '0xYOUR_LON_CA_HERE',
```

Save and refresh the browser.

## 4) Run game client later

Double click:

```text
windows\02_RUN_CLIENT_WINDOWS.bat
```

Open:

```text
http://localhost:8080/client/
```

## Important

This patch reads and displays `$LoN` from Monad. It does not mint tokens and it does not send transactions.

For a serious public economy, payment/spending must be verified on the server too. This patch removes/hides the old visible currency on the client and shows `$LoN` in Inventory, but old server-side shop logic may still need a deeper backend rewrite when you are ready.
