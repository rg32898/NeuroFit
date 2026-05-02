import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AccessPayload {
  sub: string;
}

export interface RefreshPayload {
  sub: string;
  ver: number;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies AccessPayload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(userId: string, tokenVersion: number): string {
  return jwt.sign(
    { sub: userId, ver: tokenVersion } satisfies RefreshPayload,
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"] },
  );
}

export function verifyAccess(token: string): AccessPayload {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessPayload;
}

export function verifyRefresh(token: string): RefreshPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshPayload;
}
