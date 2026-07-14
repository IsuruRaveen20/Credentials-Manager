import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { Injectable } from "@nestjs/common";

const ALGO = "aes-256-gcm";
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class CryptoService {
  encryptPayload(plaintext: Buffer, dek: Buffer): Buffer {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, dek, iv);
    const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from([VERSION]), iv, enc, tag]);
  }

  decryptPayload(blob: Buffer, dek: Buffer): Buffer {
    if (blob.length < 1 + IV_LEN + TAG_LEN) {
      throw new Error("Invalid ciphertext");
    }
    const version = blob.readUInt8(0);
    if (version !== VERSION) {
      throw new Error("Unsupported ciphertext version");
    }
    const iv = blob.subarray(1, 1 + IV_LEN);
    const tag = blob.subarray(blob.length - TAG_LEN);
    const data = blob.subarray(1 + IV_LEN, blob.length - TAG_LEN);
    const decipher = createDecipheriv(ALGO, dek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
}
