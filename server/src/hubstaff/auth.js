// Turns the Personal Access Token (PAT) into short-lived access tokens.
//
// Hubstaff treats the PAT as a refresh token and ROTATES it on every exchange, so the
// newest refresh token is saved to data/tokens.json. If .env gets a different PAT, the
// saved chain is discarded and the new PAT is used. Hubstaff allows only 5 refreshes
// per hour per token, which is why the access token is cached until it expires.
import fs from "node:fs";
import path from "node:path";

const EXPIRY_SKEW_SECONDS = 60;
const DEFAULT_LIFETIME_SECONDS = 86400;

export class TokenManager {
  constructor({ pat, tokenUrl, dataDir }) {
    this.pat = pat;
    this.tokenUrl = tokenUrl;
    this.file = path.join(dataDir, "tokens.json");
    this.tokens = this.load();
    this.pending = null; // in-flight exchange, shared by concurrent callers
  }

  load() {
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (saved.sourcePat === this.pat) return saved;
    } catch {
      // no file yet, or unreadable: start from the PAT
    }
    return { sourcePat: this.pat, refreshToken: this.pat, accessToken: null, expiresAt: 0 };
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.tokens, null, 2));
    fs.renameSync(tmp, this.file);
  }

  isExpired() {
    return Date.now() / 1000 >= this.tokens.expiresAt - EXPIRY_SKEW_SECONDS;
  }

  async getAccessToken() {
    if (this.tokens.accessToken && !this.isExpired()) return this.tokens.accessToken;
    return this.exchange();
  }

  // Called by the API client when Hubstaff answers 401 with a token we believed was valid.
  async forceRefresh(staleToken) {
    if (this.tokens.accessToken && this.tokens.accessToken !== staleToken) return this.tokens.accessToken;
    return this.exchange();
  }

  exchange() {
    if (!this.pending) {
      this.pending = this.doExchange().finally(() => {
        this.pending = null;
      });
    }
    return this.pending;
  }

  async doExchange() {
    if (!this.tokens.refreshToken) {
      throw new Error("HUBSTAFF_PAT is not set. Copy .env.example to .env and add your token.");
    }
    const res = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: this.tokens.refreshToken }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) {
      const reason = body.error_description || body.error || res.statusText;
      throw new Error(`Hubstaff token refresh failed (${res.status}): ${reason}`);
    }
    this.tokens = {
      sourcePat: this.pat,
      refreshToken: body.refresh_token || this.tokens.refreshToken,
      accessToken: body.access_token,
      expiresAt: Date.now() / 1000 + (body.expires_in || DEFAULT_LIFETIME_SECONDS),
    };
    this.save();
    return this.tokens.accessToken;
  }
}
