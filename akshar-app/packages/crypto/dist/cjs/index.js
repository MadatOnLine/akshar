"use strict";
/**
 * @akshar/crypto — Akshar Protocol cryptographic primitives.
 *
 * Provides ECDH key exchange, AES-256-GCM encryption, onion routing,
 * face hashing, and utility functions. Platform-agnostic via CryptoProvider.
 *
 * Usage:
 *   import { setCryptoProvider, NodeCryptoProvider, generateKeyPair, encrypt, decrypt } from '@akshar/crypto';
 *   setCryptoProvider(new NodeCryptoProvider());
 *   const keys = generateKeyPair();
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromHex = exports.toHex = exports.generateMsgId = exports.hammingDistance = exports.computeFaceHash = exports.wrapReturnOnion = exports.peelOnion = exports.wrapOnion = exports.ratchetKey = exports.decrypt = exports.encrypt = exports.deriveSharedKey = exports.generateKeyPair = exports.MobileCryptoProvider = exports.NodeCryptoProvider = exports.getCryptoProvider = exports.setCryptoProvider = void 0;
// Provider
var provider_js_1 = require("./provider.js");
Object.defineProperty(exports, "setCryptoProvider", { enumerable: true, get: function () { return provider_js_1.setCryptoProvider; } });
Object.defineProperty(exports, "getCryptoProvider", { enumerable: true, get: function () { return provider_js_1.getCryptoProvider; } });
var node_provider_js_1 = require("./node-provider.js");
Object.defineProperty(exports, "NodeCryptoProvider", { enumerable: true, get: function () { return node_provider_js_1.NodeCryptoProvider; } });
var mobile_provider_js_1 = require("./mobile-provider.js");
Object.defineProperty(exports, "MobileCryptoProvider", { enumerable: true, get: function () { return mobile_provider_js_1.MobileCryptoProvider; } });
// Key exchange
var keys_js_1 = require("./keys.js");
Object.defineProperty(exports, "generateKeyPair", { enumerable: true, get: function () { return keys_js_1.generateKeyPair; } });
Object.defineProperty(exports, "deriveSharedKey", { enumerable: true, get: function () { return keys_js_1.deriveSharedKey; } });
// Encryption
var encryption_js_1 = require("./encryption.js");
Object.defineProperty(exports, "encrypt", { enumerable: true, get: function () { return encryption_js_1.encrypt; } });
Object.defineProperty(exports, "decrypt", { enumerable: true, get: function () { return encryption_js_1.decrypt; } });
Object.defineProperty(exports, "ratchetKey", { enumerable: true, get: function () { return encryption_js_1.ratchetKey; } });
// Onion routing
var onion_js_1 = require("./onion.js");
Object.defineProperty(exports, "wrapOnion", { enumerable: true, get: function () { return onion_js_1.wrapOnion; } });
Object.defineProperty(exports, "peelOnion", { enumerable: true, get: function () { return onion_js_1.peelOnion; } });
Object.defineProperty(exports, "wrapReturnOnion", { enumerable: true, get: function () { return onion_js_1.wrapReturnOnion; } });
// Face hashing
var face_hash_js_1 = require("./face-hash.js");
Object.defineProperty(exports, "computeFaceHash", { enumerable: true, get: function () { return face_hash_js_1.computeFaceHash; } });
Object.defineProperty(exports, "hammingDistance", { enumerable: true, get: function () { return face_hash_js_1.hammingDistance; } });
// Utilities
var utils_js_1 = require("./utils.js");
Object.defineProperty(exports, "generateMsgId", { enumerable: true, get: function () { return utils_js_1.generateMsgId; } });
Object.defineProperty(exports, "toHex", { enumerable: true, get: function () { return utils_js_1.toHex; } });
Object.defineProperty(exports, "fromHex", { enumerable: true, get: function () { return utils_js_1.fromHex; } });
//# sourceMappingURL=index.js.map