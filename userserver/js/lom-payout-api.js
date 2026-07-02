'use strict';

require('dotenv').config();

var http = require('http');
var https = require('https');
var fs = require('fs');
var redis = require('redis');
var E = require('ethers');
var ethers = E.ethers || E;

var PORT = parseInt(process.env.PAYOUT_API_PORT || '1355', 10);
var REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
var REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
var REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

var TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || '0x53Bc12b090CfC365E7394d1cC745F8ac04117777';
var MONAD_RPC = process.env.MONAD_RPC || 'https://rpc.monad.xyz';
var PAYOUT_PRIVATE_KEY = process.env.PAYOUT_PRIVATE_KEY || '';

var TOKEN_DECIMALS = parseInt(process.env.TOKEN_DECIMALS || '18', 10);
var POINTS_PER_TOKEN = parseInt(process.env.POINTS_PER_TOKEN || '100', 10);
var MIN_PAYOUT_POINTS = parseInt(process.env.MIN_PAYOUT_POINTS || '100', 10);

var ALLOWED_ORIGINS = [
  'http://135.181.154.254',
  'http://landofnads.xyz',
  'http://www.landofnads.xyz',
  'https://landofnads.xyz',
  'https://www.landofnads.xyz',
  'http://localhost',
  'http://127.0.0.1'
];

var ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)'
];

function isAddress(addr) {
  if (!addr) return false;
  if (ethers.isAddress) return ethers.isAddress(addr);
  return ethers.utils.isAddress(addr);
}

function verifyMessage(message, signature) {
  if (ethers.verifyMessage) return ethers.verifyMessage(message, signature);
  return ethers.utils.verifyMessage(message, signature);
}

function parseUnits(value, decimals) {
  if (ethers.parseUnits) return ethers.parseUnits(value, decimals);
  return ethers.utils.parseUnits(value, decimals);
}

function lessThan(a, b) {
  if (typeof a === 'bigint' || typeof b === 'bigint') return a < b;
  return a.lt(b);
}

function getProvider(rpc) {
  if (ethers.JsonRpcProvider) return new ethers.JsonRpcProvider(rpc);
  return new ethers.providers.JsonRpcProvider(rpc);
}

function json(res, code, data, origin) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function cleanName(x) {
  return String(x || '').trim().replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 32);
}

function buildMessage(wallet, username, playerName, timestamp) {
  return [
    'Land of Nads payout',
    'wallet:' + wallet,
    'username:' + username,
    'player:' + playerName,
    'timestamp:' + timestamp
  ].join('\n');
}

function readBody(req) {
  return new Promise(function(resolve, reject) {
    var body = '';
    req.on('data', function(chunk) {
      body += chunk.toString();
      if (body.length > 1024 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', function() {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

var redisClient = redis.createClient(REDIS_PORT, REDIS_HOST, { socket_nodelay: true });

if (REDIS_PASSWORD) {
  redisClient.auth(REDIS_PASSWORD);
}

redisClient.on('error', function(err) {
  console.error('[payout-api] Redis error:', err && err.message ? err.message : err);
});

function hget(key, field) {
  return new Promise(function(resolve, reject) {
    redisClient.hget(key, field, function(err, reply) {
      if (err) return reject(err);
      resolve(reply);
    });
  });
}

function hset(key, field, value) {
  return new Promise(function(resolve, reject) {
    redisClient.hset(key, field, value, function(err, reply) {
      if (err) return reject(err);
      resolve(reply);
    });
  });
}

function rpush(key, value) {
  return new Promise(function(resolve) {
    redisClient.rpush(key, value, function() {
      resolve();
    });
  });
}

var provider = null;
var payoutWallet = null;
var token = null;

function initWallet() {
  if (!PAYOUT_PRIVATE_KEY) {
    console.warn('[payout-api] PAYOUT_PRIVATE_KEY missing. Payouts will fail until .env is set.');
    return;
  }

  provider = getProvider(MONAD_RPC);
  payoutWallet = new ethers.Wallet(PAYOUT_PRIVATE_KEY, provider);
  token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, payoutWallet);

  console.log('[payout-api] payout wallet:', payoutWallet.address);
  console.log('[payout-api] token:', TOKEN_ADDRESS);
}

var locks = {};

async function handlePayout(payload) {
  if (!PAYOUT_PRIVATE_KEY || !token || !payoutWallet) {
    return { ok: false, error: 'Payout wallet not configured on VPS' };
  }

  var wallet = String(payload.wallet || '').trim();
  var username = cleanName(payload.username).toLowerCase();
  var playerName = cleanName(payload.playerName);
  var timestamp = parseInt(payload.timestamp || '0', 10);
  var signature = String(payload.signature || '').trim();

  if (!isAddress(wallet)) {
    return { ok: false, error: 'Invalid wallet' };
  }

  if (!username || !playerName) {
    return { ok: false, error: 'Missing username or player name' };
  }

  if (!signature) {
    return { ok: false, error: 'Missing wallet signature' };
  }

  var now = Date.now();
  if (!timestamp || Math.abs(now - timestamp) > 5 * 60 * 1000) {
    return { ok: false, error: 'Signature expired. Try again.' };
  }

  var message = buildMessage(wallet, username, playerName, timestamp);
  var signer = verifyMessage(message, signature);

  if (String(signer).toLowerCase() !== String(wallet).toLowerCase()) {
    return { ok: false, error: 'Wallet signature does not match wallet' };
  }

  var userKey = 'u:' + username;
  var playersString = await hget(userKey, 'players');

  if (!playersString) {
    return { ok: false, error: 'User has no players saved' };
  }

  var players = playersString.split(',').map(function(x) { return String(x || '').trim(); }).filter(Boolean);
  var realPlayerName = null;

  for (var i = 0; i < players.length; i++) {
    if (players[i].toLowerCase() === playerName.toLowerCase()) {
      realPlayerName = players[i];
      break;
    }
  }

  if (!realPlayerName) {
    return { ok: false, error: 'This player does not belong to this username' };
  }

  var lockKey = realPlayerName.toLowerCase();
  if (locks[lockKey]) {
    return { ok: false, error: 'Payout already running. Wait.' };
  }

  locks[lockKey] = true;

  try {
    var playerKey = 'p:' + realPlayerName;
    var goldString = await hget(playerKey, 'gold');

    if (!goldString) {
      return { ok: false, error: 'No saved gold found. Save/relog first.' };
    }

    var goldParts = String(goldString).split(',');
    var savedGold = parseInt(goldParts[0] || '0', 10);

    if (!Number.isFinite(savedGold) || savedGold < 0) savedGold = 0;

    if (savedGold < MIN_PAYOUT_POINTS) {
      return {
        ok: false,
        error: 'Need at least ' + MIN_PAYOUT_POINTS + ' saved points/gold. Current saved: ' + savedGold,
        savedGold: savedGold
      };
    }

    var tokenAmountWhole = Math.floor(savedGold / POINTS_PER_TOKEN);

    if (tokenAmountWhole <= 0) {
      return {
        ok: false,
        error: 'Not enough points for 1 token',
        savedGold: savedGold
      };
    }

    var spentGold = tokenAmountWhole * POINTS_PER_TOKEN;
    var remainingGold = savedGold - spentGold;

    var amountWei = parseUnits(String(tokenAmountWhole), TOKEN_DECIMALS);
    var payoutBalance = await token.balanceOf(payoutWallet.address);

    if (lessThan(payoutBalance, amountWei)) {
      return { ok: false, error: 'Payout wallet has not enough tokens' };
    }

    var tx = await token.transfer(wallet, amountWei);
    await tx.wait();

    goldParts[0] = String(remainingGold);
    await hset(playerKey, 'gold', goldParts.join(','));

    await rpush('lon:payouts', JSON.stringify({
      time: Date.now(),
      username: username,
      playerName: realPlayerName,
      wallet: wallet,
      spentGold: spentGold,
      remainingGold: remainingGold,
      tokenAmount: tokenAmountWhole,
      txHash: tx.hash
    }));

    return {
      ok: true,
      txHash: tx.hash,
      wallet: wallet,
      playerName: realPlayerName,
      paidTokens: tokenAmountWhole,
      spentGold: spentGold,
      remainingGold: remainingGold
    };
  } finally {
    delete locks[lockKey];
  }
}

async function handler(req, res) {
  var origin = req.headers.origin || '*';

  if (origin !== '*' && ALLOWED_ORIGINS.indexOf(origin) === -1) {
    origin = '*';
  }

  if (req.method === 'OPTIONS') {
    return json(res, 200, { ok: true }, origin);
  }

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'land-of-nads-payout-api',
      token: TOKEN_ADDRESS,
      pointsPerToken: POINTS_PER_TOKEN,
      minPayoutPoints: MIN_PAYOUT_POINTS
    }, origin);
  }

  if (req.method === 'POST' && req.url === '/payout') {
    try {
      var body = await readBody(req);
      var result = await handlePayout(body);
      return json(res, result.ok ? 200 : 400, result, origin);
    } catch (err) {
      console.error('[payout-api] error:', err && err.stack ? err.stack : err);
      return json(res, 500, {
        ok: false,
        error: err && err.message ? err.message : 'Payout API error'
      }, origin);
    }
  }

  return json(res, 404, { ok: false, error: 'Not found' }, origin);
}

initWallet();

var SSL_CERT = process.env.SSL_CERT || '';
var SSL_KEY = process.env.SSL_KEY || '';

if (SSL_CERT && SSL_KEY && fs.existsSync(SSL_CERT) && fs.existsSync(SSL_KEY)) {
  https.createServer({
    cert: fs.readFileSync(SSL_CERT),
    key: fs.readFileSync(SSL_KEY)
  }, handler).listen(PORT, '0.0.0.0', function() {
    console.log('[payout-api] HTTPS running on port ' + PORT);
  });
} else {
  http.createServer(handler).listen(PORT, '0.0.0.0', function() {
    console.log('[payout-api] HTTP running on port ' + PORT);
  });
}
