# Backend image. Build context is the REPO ROOT (see docker-compose.yml)
# so we can copy lib/system-prompt.ts — the single source of truth for the
# koan prompt — into the image.

# 3.12, not 3.13: Python 3.13 turned on strict X.509 verification, which
# rejects the slightly non-conformant CA certs that TLS-intercepting antivirus
# (Norton Web Shield on this machine) generates. 3.12 accepts them.
FROM python:3.12-slim

WORKDIR /app

# Install deps first for layer caching.
# --trusted-host works around TLS-intercepting proxies (this machine's npm
# needed the same treatment); harmless on normal networks.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir \
    --trusted-host pypi.org --trusted-host files.pythonhosted.org \
    -r requirements.txt

# App code + the TS prompt file (parsed by prompt.py at startup).
COPY backend/ .
COPY lib/system-prompt.ts lib/system-prompt.ts

# Trust locally-exported root CAs (backend/certs/*.crt). Needed on machines
# where antivirus/corporate software intercepts TLS (e.g. Norton Web Shield):
# Windows trusts the interception cert, but this Linux container doesn't, so
# outbound HTTPS (the Anthropic API call) would fail certificate verification.
# Appending to the certifi bundle covers httpx/anthropic, which don't read the
# system store. No-op when the folder holds no .crt files.
RUN cp certs/*.crt /usr/local/share/ca-certificates/ 2>/dev/null && update-ca-certificates || true
RUN if ls certs/*.crt >/dev/null 2>&1; then \
      cat certs/*.crt >> "$(python -c 'import certifi; print(certifi.where())')"; \
    fi

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
