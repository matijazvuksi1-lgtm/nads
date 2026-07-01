# Scan / Patch Report — Monad $LoN Currency

Repo target: `Langerz82/landofmana`

Observed structure from the public GitHub repo:

- `client/`
- `gameserver/`
- `userserver/`
- Windows launchers: `userserver-win.bat`, `gameserver-win.bat`
- Client inventory code includes `setCurrency(gold, gems)` and visible `.inventoryGold`, `.inventoryGems` UI classes.

Patch strategy:

1. Do not replace the full game.
2. Backup changed files first.
3. Inject one clean marker block into `client/index.html`.
4. Write custom mod files into `client/custom/`:
   - `lom-web3-config.js`
   - `lom-web3.css`
   - `lom-web3.js`
   - `lom-monad-currency.js`
5. Remove older Web3 injection markers before adding the new one.
6. Duplicate check after patch.
7. Show `$LoN` balance in the Inventory window.
8. Hide old visible Gold/Gems inventory UI and override the client `setCurrency` method.
9. Use Monad mainnet chain ID `143` / hex `0x8f` and RPC `https://rpc.monad.xyz` by default.

Limit:

This is client-side integration. For production, server-side economy verification is still needed so players cannot cheat by editing the browser.
