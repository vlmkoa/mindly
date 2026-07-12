# Local TLS roots

If HTTPS calls from the API container fail with `CERTIFICATE_VERIFY_FAILED`,
some software on the host (antivirus like Norton Web Shield, or a corporate
proxy) is intercepting TLS with its own root certificate. Windows trusts it;
the Linux container doesn't.

Fix: export that root certificate as a PEM `.crt` file into this folder and
rebuild the image (`npm run backend`). The Dockerfile appends every `.crt`
here to the container's trust bundles.

Export on Windows (PowerShell, adjust the -like filter):

```powershell
$cert = Get-ChildItem Cert:\LocalMachine\Root | Where-Object Subject -like "*Norton*" | Select-Object -First 1
$b64 = [Convert]::ToBase64String($cert.RawData, "InsertLineBreaks")
Set-Content backend\certs\local-tls-root.crt "-----BEGIN CERTIFICATE-----`n$b64`n-----END CERTIFICATE-----" -Encoding ascii
```

The exported file is a *public* certificate (no private key), but it is
machine-specific, so `*.crt` files here are gitignored.
