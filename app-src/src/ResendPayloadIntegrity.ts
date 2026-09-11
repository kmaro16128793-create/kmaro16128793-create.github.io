type StoredRequest = {
  budget?: string;
  invoice?: boolean;
};

const QUOTE_ENDPOINT = 'https://mina-brunch-mail-service-srzp7k.v2.appdeploy.ai/api/send-quote';
let installed = false;

function readRequest(): StoredRequest {
  try {
    const raw = localStorage.getItem('mina-video-request');
    return raw ? JSON.parse(raw) as StoredRequest : {};
  } catch {
    return {};
  }
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function installResendPayloadIntegrity() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (requestUrl(input) === QUOTE_ENDPOINT && (init?.method || 'GET').toUpperCase() === 'POST' && typeof init?.body === 'string') {
      try {
        const payload = JSON.parse(init.body) as Record<string, unknown>;
        const request = readRequest();
        const body = JSON.stringify({
          ...payload,
          budget: request.budget?.trim() || 'À définir',
          invoice: Boolean(request.invoice)
        });
        return nativeFetch(input, { ...init, body });
      } catch {
        // Keep the original request untouched if its body is not valid JSON.
      }
    }
    return nativeFetch(input, init);
  };
}
