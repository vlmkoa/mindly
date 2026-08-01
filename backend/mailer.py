"""Outbound email: password-reset and verification links.

EMAIL_MODE=console (default) prints the link to stdout — local dev needs no
AWS. EMAIL_MODE=ses sends through SES with ambient credentials (the EC2
instance role in prod; no keys on disk).

Send failures are logged, never raised: an email hiccup must not 500 a
signup or a forgot-password request.
"""

import logging

import config

log = logging.getLogger("mailer")


def _send_ses(to: str, subject: str, body: str) -> None:
    import boto3  # lazy import — console mode never needs it

    client = boto3.client("sesv2", region_name=config.AWS_REGION)
    client.send_email(
        FromEmailAddress=config.EMAIL_FROM,
        Destination={"ToAddresses": [to]},
        Content={
            "Simple": {
                "Subject": {"Data": subject},
                "Body": {"Text": {"Data": body}},
            }
        },
    )


def send(to: str, subject: str, body: str) -> None:
    if config.EMAIL_MODE == "ses":
        try:
            _send_ses(to, subject, body)
        except Exception:
            log.exception("SES send failed (to=%s, subject=%r)", to, subject)
    else:
        print(f"[mail:console] to={to} | {subject}\n{body}", flush=True)


def send_reset_link(to: str, token: str) -> None:
    link = f"{config.FRONTEND_ORIGIN}/reset?token={token}"
    send(
        to,
        "Reset your mindly password",
        "Someone asked to reset the password for this address on mindly.\n\n"
        f"Reset it here (the link works for {config.RESET_TOKEN_TTL_MIN} minutes):\n"
        f"{link}\n\n"
        "If this wasn't you, ignore this email — nothing changes.",
    )


def send_verify_link(to: str, token: str) -> None:
    link = f"{config.FRONTEND_ORIGIN}/verify?token={token}"
    send(
        to,
        "Verify your mindly email",
        "Welcome to mindly.\n\n"
        "Confirm this address to unlock the mirror chat:\n"
        f"{link}\n\n"
        "If you didn't create this account, ignore this email.",
    )
