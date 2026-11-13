import crypto from 'crypto';

const SECRET = process.env.QR_HMAC_SECRET || 'campus360_smart_attendance_hmac_secret_2026';
const VALIDITY_WINDOW_MS = 60 * 1000; // 60 seconds rolling window

/**
 * Generates an ultra-compact, signed single-use token for student QR code.
 * Packed as a minimal binary buffer in Base64URL:
 * - 12 bytes: studentId (ObjectId hex decoded)
 * - 4 bytes: timestamp (Unix timestamp in seconds)
 * - 2 bytes: random nonce
 * - 8 bytes: truncated HMAC-SHA256 signature
 * Total length = 26 bytes = 35 characters in Base64URL!
 *
 * This reduces QR matrix complexity by ~75% (Version 2 QR instead of Version 8),
 * creating much larger, bolder squares that any camera can detect instantly.
 *
 * @param {string} studentId
 * @returns {string} Ultra-compact 35-character Base64URL token string
 */
export const generateStudentQrToken = (studentId) => {
  const studentIdStr = studentId.toString();

  // If valid 24-character hex MongoDB ObjectId, use 26-byte ultra-compact binary packing
  if (/^[0-9a-fA-F]{24}$/.test(studentIdStr)) {
    const idBuf = Buffer.from(studentIdStr, 'hex'); // 12 bytes
    const tsSec = Math.floor(Date.now() / 1000); // 4 bytes uint32
    const tsBuf = Buffer.alloc(4);
    tsBuf.writeUInt32BE(tsSec, 0);
    const nonceBuf = crypto.randomBytes(2); // 2 bytes
    const nonceHex = nonceBuf.toString('hex');

    const data = `${studentIdStr}:${tsSec}:${nonceHex}`;
    const fullSig = crypto.createHmac('sha256', SECRET).update(data).digest();
    const sigBuf = fullSig.subarray(0, 8); // 8 bytes (64-bit HMAC)

    const packed = Buffer.concat([idBuf, tsBuf, nonceBuf, sigBuf]);
    return packed.toString('base64url'); // Exactly 35 characters!
  }

  // Fallback for non-ObjectId string identifiers (e.g. mock test IDs)
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(3).toString('hex');
  const data = `${studentIdStr}:${timestamp}:${nonce}`;
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex').substring(0, 16);
  return `c.${studentIdStr}.${timestamp}.${nonce}.${signature}`;
};

/**
 * Validates the student QR token supporting:
 * 1. Ultra-compact 26-byte binary Base64URL tokens (Version 2 QR, 35 chars)
 * 2. Delimited compact tokens (`c.<id>.<ts>.<nonce>.<sig>`)
 * 3. Legacy Base64 JSON tokens (backward compatibility)
 *
 * @param {string} token
 * @returns {{ valid: boolean, studentId?: string, reason?: string, nonce?: string }}
 */
export const verifyStudentQrToken = (token) => {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Invalid or missing QR token' };
    }

    const trimmed = token.trim();

    // 1. Try Ultra-Compact Binary Base64URL Token (26 bytes unpacked)
    const rawBuf = Buffer.from(trimmed, 'base64url');
    if (rawBuf.length === 26) {
      const studentId = rawBuf.subarray(0, 12).toString('hex');
      const tsSec = rawBuf.readUInt32BE(12);
      const nonce = rawBuf.subarray(12 + 4, 12 + 4 + 2).toString('hex');
      const sig = rawBuf.subarray(18, 26);

      const ageMs = Date.now() - tsSec * 1000;
      if (ageMs > VALIDITY_WINDOW_MS || ageMs < -5000) {
        return { valid: false, reason: 'QR code has expired. Please refresh the code.' };
      }

      const expectedData = `${studentId}:${tsSec}:${nonce}`;
      const expectedSig = crypto.createHmac('sha256', SECRET).update(expectedData).digest().subarray(0, 8);

      if (!crypto.timingSafeEqual(sig, expectedSig)) {
        return { valid: false, reason: 'Invalid QR token cryptographic signature' };
      }

      return { valid: true, studentId, nonce };
    }

    // 2. Try Delimited Compact Token (`c.<id>.<ts>.<nonce>.<sig>`)
    if (trimmed.startsWith('c.')) {
      const parts = trimmed.split('.');
      if (parts.length === 5) {
        const [, studentId, tsStr, nonce, sig] = parts;
        const timestamp = Number(tsStr);
        const age = Date.now() - timestamp;
        if (age > VALIDITY_WINDOW_MS || age < -5000) {
          return { valid: false, reason: 'QR code has expired. Please refresh the code.' };
        }

        const expectedData = `${studentId}:${timestamp}:${nonce}`;
        const expectedSig = crypto.createHmac('sha256', SECRET).update(expectedData).digest('hex').substring(0, 16);
        if (sig !== expectedSig) {
          return { valid: false, reason: 'Invalid QR token cryptographic signature' };
        }

        return { valid: true, studentId, nonce };
      }
    }

    // 3. Fallback: Legacy Base64 JSON token
    const legacyRaw = Buffer.from(trimmed, 'base64').toString('utf8');
    if (legacyRaw.startsWith('{')) {
      const { studentId, timestamp, nonce, sig } = JSON.parse(legacyRaw);
      if (!studentId || !timestamp || !nonce || !sig) {
        return { valid: false, reason: 'Malformed QR token structure' };
      }

      const age = Date.now() - timestamp;
      if (age > VALIDITY_WINDOW_MS || age < -5000) {
        return { valid: false, reason: 'QR code has expired. Please refresh the code.' };
      }

      const expectedData = `${studentId}:${timestamp}:${nonce}`;
      const expectedSig = crypto.createHmac('sha256', SECRET).update(expectedData).digest('hex');
      if (sig !== expectedSig) {
        return { valid: false, reason: 'Invalid QR token cryptographic signature' };
      }

      return { valid: true, studentId, nonce };
    }

    return { valid: false, reason: 'Unrecognized QR token format' };
  } catch (err) {
    return { valid: false, reason: 'Failed to decode QR token: ' + err.message };
  }
};
