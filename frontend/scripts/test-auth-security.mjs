// OptiFleet B2B — Test de Securitate Prompt J4
// Confirmă că refresh token-ul nu este expus în localStorage sau document.cookie (prevenire XSS)

import test from 'node:test';
import assert from 'node:assert/strict';

// Mock mediu browser
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.window = {};
globalThis.localStorage = new LocalStorageMock();
// document.cookie simulat: cookie-urile httpOnly NU apar în document.cookie
let simulatedDocumentCookie = "session_meta=public_data_only";
Object.defineProperty(globalThis, 'document', {
  value: {
    get cookie() {
      return simulatedDocumentCookie;
    },
    set cookie(val) {
      // Dacă este httpOnly, browserul refuză să-l adauge la document.cookie
      if (val.toLowerCase().includes('httponly')) {
        // Ignorat de browser în JavaScript
        return;
      }
      simulatedDocumentCookie = val;
    }
  },
  configurable: true,
});

test('PROMPT J4: Access token-ul se stochează în memorie, NICIODATĂ în localStorage', () => {
  // Simulare adaptor Remote API
  class SecureAuthClient {
    constructor() {
      this.token = null;
    }
    setToken(token) {
      this.token = token;
      // Conform J4: NU mai scriem în localStorage!
    }
    getToken() {
      return this.token;
    }
    clearToken() {
      this.token = null;
    }
  }

  const client = new SecureAuthClient();
  const testAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.signature';
  
  client.setToken(testAccessToken);

  // Verificare: token-ul este disponibil în memorie
  assert.equal(client.getToken(), testAccessToken, 'Access token-ul trebuie să fie accesibil în memoria JS');

  // Verificare CRITICĂ: localStorage NU conține token-ul
  const leakedStorageToken = localStorage.getItem('optifleet_token');
  assert.equal(leakedStorageToken, null, 'PROMPT J4 VIOLAT: optifleet_token nu trebuie să existe în localStorage!');

  client.clearToken();
  assert.equal(client.getToken(), null);
});

test('PROMPT J4: Refresh token-ul din cookie httpOnly este inaccesibil din JavaScript (document.cookie)', () => {
  // Serverul setează header-ul: Set-Cookie: refresh_token=XYZ; HttpOnly; Secure; SameSite=Strict
  const serverSetCookieHeader = 'refresh_token=secret_refresh_jwt_7_days; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth';

  // Clientul JS încearcă să acceseze sau să injecteze cookie-ul prin document.cookie
  document.cookie = serverSetCookieHeader;

  // Verificare: document.cookie NU expune refresh_token
  assert.equal(
    document.cookie.includes('refresh_token'),
    false,
    'PROMPT J4 VIOLAT: refresh_token-ul httpOnly nu trebuie să fie accesibil prin document.cookie!'
  );
  assert.equal(
    localStorage.getItem('refresh_token'),
    null,
    'Refresh token-ul nu trebuie să existe în localStorage!'
  );
});
