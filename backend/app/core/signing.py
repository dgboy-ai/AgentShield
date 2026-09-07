"""
Signing Engine
==============

ECDSA-P256 digital signatures for non-repudiable memory integrity.

MVP: Local ECDSA using the `cryptography` library.
Production: AWS KMS ECDSA-P256 (private key never leaves HSM).

Upgrade path: Swap LocalSigner → KMSSigner (one class change).

Every sign/verify call is logged to the audit trail for
non-repudiation — even a compromised server cannot forge
memories without detection.
"""

import base64
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.hazmat.primitives.asymmetric.ec import (
    SECP256R1,
    EllipticCurvePrivateKey,
    EllipticCurvePublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)
from cryptography.exceptions import InvalidSignature

_SIGNING_KEY_DIR = Path(os.path.expanduser("~/.agentshield"))
_SIGNING_KEY_FILE = Path(os.getenv("SIGNING_KEY_FILE", str(_SIGNING_KEY_DIR / "signing_key.pem")))
# Optional persistent PEM via env (for Render/ephemeral FS): set SIGNING_PRIVATE_KEY to PEM string or base64-encoded PEM
_SIGNING_PRIVATE_KEY_ENV = os.getenv("SIGNING_PRIVATE_KEY", "").strip()
_SIGNING_PRIVATE_KEY_B64_ENV = os.getenv("SIGNING_PRIVATE_KEY_B64", "").strip()


class SigningBackend(str, Enum):
    LOCAL = "local"
    AWS_KMS = "aws_kms"


class SignatureRecord:
    """Record of a sign/verify operation for audit trail."""

    def __init__(
        self,
        record_id: str,
        operation: str,
        backend: SigningBackend,
        message_hash: str,
        signature: str,
        key_id: str,
        valid: Optional[bool] = None,
        error: Optional[str] = None,
    ):
        self.record_id = record_id
        self.operation = operation
        self.backend = backend
        self.message_hash = message_hash
        self.signature = signature
        self.key_id = key_id
        self.valid = valid
        self.error = error
        self.timestamp = datetime.now(timezone.utc)

    def to_dict(self) -> dict:
        return {
            "record_id": self.record_id,
            "operation": self.operation,
            "backend": self.backend.value,
            "message_hash": self.message_hash,
            "signature": self.signature[:64] + "..." if len(self.signature) > 64 else self.signature,
            "key_id": self.key_id,
            "valid": self.valid,
            "error": self.error,
            "timestamp": self.timestamp.isoformat(),
        }


class SigningResult:
    """Result of a sign or verify operation."""

    def __init__(
        self,
        success: bool,
        signature: Optional[str] = None,
        key_id: Optional[str] = None,
        backend: SigningBackend = SigningBackend.LOCAL,
        error: Optional[str] = None,
        latency_ms: float = 0,
    ):
        self.success = success
        self.signature = signature
        self.key_id = key_id
        self.backend = backend
        self.error = error
        self.latency_ms = latency_ms
        self.timestamp = datetime.now(timezone.utc)

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "signature": self.signature[:64] + "..." if self.signature and len(self.signature) > 64 else self.signature,
            "key_id": self.key_id,
            "backend": self.backend.value,
            "error": self.error,
            "latency_ms": round(self.latency_ms, 2),
            "timestamp": self.timestamp.isoformat(),
        }


class SigningEngine:
    """
    ECDSA-P256 signing engine with local and KMS backends.

    Honest architecture:
      - SigningBackend.LOCAL: cryptography library, key in ~/.agentshield/signing_key.pem (dev/self-hosted)
      - SigningBackend.AWS_KMS: boto3 kms:Sign/Verify with ECC_NIST_P256 key (private key never leaves HSM,
        every sign/verify logged in CloudTrail). Requires AWS_KMS_KEY_ID + AWS credentials.
        If KMS is requested but not configured, gracefully falls back to LOCAL (never crashes).
      Claim guidance: say "ECDSA-P256 (local dev, KMS-ready — set AWS_KMS_KEY_ID for HSM-backed signing)"
      not "AWS KMS" unconditionally.

    Usage:
        engine = SigningEngine()  # local by default
        engine = SigningEngine(backend=SigningBackend.AWS_KMS)  # KMS if env configured
        result = engine.sign("memory content here")
        verify = engine.verify("memory content here", result.signature)
    """

    def __init__(self, backend: SigningBackend = SigningBackend.LOCAL):
        # Auto-select KMS if env signals it, unless explicitly LOCAL
        env_backend = os.getenv("SIGNING_BACKEND", "").lower()
        if env_backend == "aws_kms":
            backend = SigningBackend.AWS_KMS
        elif env_backend == "local":
            backend = SigningBackend.LOCAL
        self.backend = backend
        self._requested_backend = backend  # remember what was requested
        self._private_key: Optional[EllipticCurvePrivateKey] = None
        self._public_key: Optional[EllipticCurvePublicKey] = None
        self._key_id: str = ""
        self._sign_count = 0
        self._verify_count = 0
        self._listeners: list = []
        self._kms_client = None  # boto3 client when KMS enabled
        self._fallback = False
        self._fallback_reason: Optional[str] = None

        self._initialize_backend()

    def _initialize_backend(self):
        if self.backend == SigningBackend.LOCAL:
            self._private_key, self._public_key = self._load_or_generate_key()
            pub_bytes = self._public_key.public_bytes(
                Encoding.X962, PublicFormat.CompressedPoint
            )
            self._key_id = hashlib.sha256(pub_bytes).hexdigest()[:16]
        elif self.backend == SigningBackend.AWS_KMS:
            self._init_kms_backend()

    def _init_kms_backend(self):
        """Initialize AWS KMS backend. Falls back to LOCAL only with explicit fallback flag (no silent downgrade)."""
        kms_key_id = os.getenv("AWS_KMS_KEY_ID", "")
        aws_region = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
        if not kms_key_id:
            # No KMS key configured — fall back to local with explicit error, do NOT crash but mark fallback
            import logging
            self._fallback = True
            self._fallback_reason = "AWS_KMS_KEY_ID not set"
            logging.getLogger("agentshield.signing").error(
                "AWS_KMS backend requested but AWS_KMS_KEY_ID not set — FALLING BACK to LOCAL (insecure, ephemeral). "
                "Set AWS_KMS_KEY_ID and AWS credentials to enable real KMS signing. Fallback flag set."
            )
            self.backend = SigningBackend.LOCAL
            self._private_key, self._public_key = self._load_or_generate_key()
            pub_bytes = self._public_key.public_bytes(
                Encoding.X962, PublicFormat.CompressedPoint
            )
            self._key_id = hashlib.sha256(pub_bytes).hexdigest()[:16]
            return
        try:
            import boto3  # type: ignore

            self._kms_client = boto3.client("kms", region_name=aws_region)
            # Verify key exists and get its ID
            resp = self._kms_client.describe_key(KeyId=kms_key_id)
            self._key_id = resp["KeyMetadata"]["KeyId"]
            # Fetch public key for local verify (KMS verify also works)
            pub_resp = self._kms_client.get_public_key(KeyId=kms_key_id)
            # pub_resp["PublicKey"] is DER-encoded SubjectPublicKeyInfo
            self._public_key = serialization.load_der_public_key(pub_resp["PublicKey"])
            self._private_key = None  # Private key never leaves KMS
            self._fallback = False
            import logging
            logging.getLogger("agentshield.signing").info(
                "AWS KMS backend initialized: key_id=%s region=%s", self._key_id, aws_region
            )
        except ImportError:
            import logging
            self._fallback = True
            self._fallback_reason = "boto3 not installed"
            logging.getLogger("agentshield.signing").error(
                "boto3 not installed — cannot use AWS KMS. FALLING BACK to LOCAL (insecure). pip install boto3"
            )
            self.backend = SigningBackend.LOCAL
            self._private_key, self._public_key = self._load_or_generate_key()
            pub_bytes = self._public_key.public_bytes(
                Encoding.X962, PublicFormat.CompressedPoint
            )
            self._key_id = hashlib.sha256(pub_bytes).hexdigest()[:16]
        except Exception as e:
            import logging
            self._fallback = True
            self._fallback_reason = str(e)
            logging.getLogger("agentshield.signing").error(
                "AWS KMS init failed (%s) — FALLING BACK to LOCAL (insecure)", e
            )
            self.backend = SigningBackend.LOCAL
            self._private_key, self._public_key = self._load_or_generate_key()
            pub_bytes = self._public_key.public_bytes(
                Encoding.X962, PublicFormat.CompressedPoint
            )
            self._key_id = hashlib.sha256(pub_bytes).hexdigest()[:16]

    def _load_or_generate_key(self) -> tuple[EllipticCurvePrivateKey, EllipticCurvePublicKey]:
        """Load existing key from disk/env, or generate and persist a new one.

        Priority:
          1. SIGNING_PRIVATE_KEY_B64 (base64-encoded PEM) or SIGNING_PRIVATE_KEY (raw PEM) env var - for Render/ephemeral FS
          2. File at SIGNING_KEY_FILE (or ~/.agentshield/signing_key.pem)
          3. Generate new and try to persist (ephemeral if persist fails)
        """
        # 1. Env var (persistent, survives deploys) - check at runtime
        env_pem_b64 = os.getenv("SIGNING_PRIVATE_KEY_B64", "").strip()
        env_pem = os.getenv("SIGNING_PRIVATE_KEY", "").strip()
        # Also check import-time cached but allow override
        if not env_pem_b64:
            env_pem_b64 = _SIGNING_PRIVATE_KEY_B64_ENV
        if not env_pem:
            env_pem = _SIGNING_PRIVATE_KEY_ENV
        for pem_str in [env_pem_b64, env_pem]:
            if pem_str:
                try:
                    # If base64, decode
                    if pem_str.strip().startswith("-----BEGIN"):
                        pem_data = pem_str.encode()
                    else:
                        # try base64 decode
                        try:
                            pem_data = base64.b64decode(pem_str)
                        except Exception:
                            pem_data = pem_str.encode()
                    private_key = serialization.load_pem_private_key(pem_data, password=None)
                    if isinstance(private_key, EllipticCurvePrivateKey):
                        import logging
                        logging.getLogger("agentshield.signing").info("Loaded signing key from env var (persistent)")
                        return private_key, private_key.public_key()
                except Exception as e:
                    import logging
                    logging.getLogger("agentshield.signing").warning(f"Failed to load SIGNING_PRIVATE_KEY from env: {e} - trying file")

        # 2. File (check env override for path)
        signing_key_file = Path(os.getenv("SIGNING_KEY_FILE", str(_SIGNING_KEY_FILE)))
        if signing_key_file.exists():
            try:
                pem_data = signing_key_file.read_bytes()
                private_key = serialization.load_pem_private_key(pem_data, password=None)
                if isinstance(private_key, EllipticCurvePrivateKey):
                    return private_key, private_key.public_key()
            except Exception:
                pass  # Corrupt key — regenerate

        private_key = ec.generate_private_key(SECP256R1())
        # 3. Try to persist
        try:
            # Use env path if set, else default
            key_dir = signing_key_file.parent
            key_dir.mkdir(parents=True, exist_ok=True)
            pem = private_key.private_bytes(
                Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()
            )
            tmp = str(signing_key_file) + ".tmp"
            with open(tmp, "wb") as f:
                f.write(pem)
            os.replace(tmp, str(signing_key_file))
            os.chmod(str(signing_key_file), 0o600)
            import logging
            logging.getLogger("agentshield.signing").warning(
                "Generated new ephemeral signing key at %s - set SIGNING_PRIVATE_KEY env var for persistence across deploys", signing_key_file
            )
        except OSError:
            pass  # Non-fatal — key works in-memory, just won't survive restart
        return private_key, private_key.public_key()

    def add_listener(self, callback):
        self._listeners.append(callback)

    def _emit(self, event_type: str, data: dict):
        for listener in self._listeners:
            listener(event_type, data)

    def _log_operation(self, record: SignatureRecord):
        self._emit("signing_operation", record.to_dict())

    def _compute_message_hash(self, message: bytes) -> str:
        return hashlib.sha256(message).hexdigest()

    def sign(self, message: str | bytes) -> SigningResult:
        """
        Sign a message using ECDSA-P256.

        Args:
            message: String or bytes to sign

        Returns:
            SigningResult with base64-encoded signature
        """
        import time

        start = time.time()

        if isinstance(message, str):
            message_bytes = message.encode("utf-8")
        else:
            message_bytes = message

        message_hash = self._compute_message_hash(message_bytes)

        try:
            if self.backend == SigningBackend.LOCAL:
                signature = self._private_key.sign(
                    message_bytes,
                    ec.ECDSA(hashes.SHA256()),
                )
                signature_b64 = base64.b64encode(signature).decode("utf-8")
            elif self.backend == SigningBackend.AWS_KMS:
                import hashlib as _hashlib

                # KMS Sign with ECDSA_SHA_256 — private key never leaves HSM
                kms_key_id = os.getenv("AWS_KMS_KEY_ID", "")
                # KMS expects raw digest; we hash then sign
                digest = _hashlib.sha256(message_bytes).digest()
                resp = self._kms_client.sign(
                    KeyId=kms_key_id,
                    Message=message_bytes,
                    MessageType="RAW",
                    SigningAlgorithm="ECDSA_SHA_256",
                )
                # KMS returns DER-encoded signature directly
                signature_b64 = base64.b64encode(resp["Signature"]).decode("utf-8")

            self._sign_count += 1

            result = SigningResult(
                success=True,
                signature=signature_b64,
                key_id=self._key_id,
                backend=self.backend,
                latency_ms=(time.time() - start) * 1000,
            )

            record = SignatureRecord(
                record_id=str(uuid.uuid4()),
                operation="sign",
                backend=self.backend,
                message_hash=message_hash,
                signature=signature_b64,
                key_id=self._key_id,
            )
            self._log_operation(record)

            return result

        except Exception as e:
            result = SigningResult(
                success=False,
                backend=self.backend,
                error=str(e),
                latency_ms=(time.time() - start) * 1000,
            )

            record = SignatureRecord(
                record_id=str(uuid.uuid4()),
                operation="sign",
                backend=self.backend,
                message_hash=message_hash,
                signature="",
                key_id=self._key_id,
                error=str(e),
            )
            self._log_operation(record)

            return result

    def verify(self, message: str | bytes, signature_b64: str) -> SigningResult:
        """
        Verify a signature.

        Args:
            message: Original message that was signed
            signature_b64: Base64-encoded signature to verify

        Returns:
            SigningResult with verification result
        """
        import time

        start = time.time()

        if isinstance(message, str):
            message_bytes = message.encode("utf-8")
        else:
            message_bytes = message

        message_hash = self._compute_message_hash(message_bytes)

        try:
            signature_bytes = base64.b64decode(signature_b64)

            if self.backend == SigningBackend.LOCAL:
                self._public_key.verify(
                    signature_bytes,
                    message_bytes,
                    ec.ECDSA(hashes.SHA256()),
                )
            elif self.backend == SigningBackend.AWS_KMS:
                kms_key_id = os.getenv("AWS_KMS_KEY_ID", "")
                # No fallback to local - HSM must verify, otherwise fail (prevents downgrade attack)
                self._kms_client.verify(
                    KeyId=kms_key_id,
                    Message=message_bytes,
                    MessageType="RAW",
                    SigningAlgorithm="ECDSA_SHA_256",
                    Signature=signature_bytes,
                )

            self._verify_count += 1

            result = SigningResult(
                success=True,
                key_id=self._key_id,
                backend=self.backend,
                latency_ms=(time.time() - start) * 1000,
            )

            record = SignatureRecord(
                record_id=str(uuid.uuid4()),
                operation="verify",
                backend=self.backend,
                message_hash=message_hash,
                signature=signature_b64,
                key_id=self._key_id,
                valid=True,
            )
            self._log_operation(record)

            return result

        except InvalidSignature:
            result = SigningResult(
                success=False,
                backend=self.backend,
                error="Invalid signature",
                latency_ms=(time.time() - start) * 1000,
            )

            record = SignatureRecord(
                record_id=str(uuid.uuid4()),
                operation="verify",
                backend=self.backend,
                message_hash=message_hash,
                signature=signature_b64,
                key_id=self._key_id,
                valid=False,
                error="Invalid signature",
            )
            self._log_operation(record)

            return result

        except Exception as e:
            result = SigningResult(
                success=False,
                backend=self.backend,
                error=str(e),
                latency_ms=(time.time() - start) * 1000,
            )

            record = SignatureRecord(
                record_id=str(uuid.uuid4()),
                operation="verify",
                backend=self.backend,
                message_hash=message_hash,
                signature=signature_b64,
                key_id=self._key_id,
                valid=False,
                error=str(e),
            )
            self._log_operation(record)

            return result

    def sign_json(self, data: dict) -> SigningResult:
        """Sign a JSON-serializable dict (canonical JSON)."""
        canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
        return self.sign(canonical)

    def verify_json(self, data: dict, signature_b64: str) -> SigningResult:
        """Verify a signature on a JSON-serializable dict."""
        canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
        return self.verify(canonical, signature_b64)

    def export_public_key(self, format: str = "pem") -> str:
        """Export the public key for external verification."""
        if format == "pem":
            return self._public_key.public_bytes(
                Encoding.PEM, PublicFormat.SubjectPublicKeyInfo
            ).decode("utf-8")
        elif format == "jwk":
            # Correct JWK export: use uncompressed point (0x04 || X || Y), then split X/Y
            # Compressed point is 33 bytes (1 prefix + 32 X), not suitable for slicing
            try:
                pub_bytes_uncompressed = self._public_key.public_bytes(
                    Encoding.X962, PublicFormat.UncompressedPoint
                )
                # Uncompressed: 0x04 + 32 X + 32 Y = 65 bytes
                x = pub_bytes_uncompressed[1:33]
                y = pub_bytes_uncompressed[33:65]
            except Exception:
                # Fallback: try to derive from numbers
                from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePublicNumbers
                numbers = self._public_key.public_numbers()
                x = numbers.x.to_bytes(32, "big")
                y = numbers.y.to_bytes(32, "big")
            return json.dumps(
                {
                    "kty": "EC",
                    "crv": "P-256",
                    "x": base64.urlsafe_b64encode(x).decode().rstrip("="),
                    "y": base64.urlsafe_b64encode(y).decode().rstrip("="),
                    "kid": self._key_id,
                }
            )
        else:
            raise ValueError(f"Unsupported format: {format}")

    def get_key_id(self) -> str:
        return self._key_id

    def get_stats(self) -> dict:
        return {
            "backend": self.backend.value,
            "requested_backend": getattr(self, "_requested_backend", self.backend).value if hasattr(self, "_requested_backend") else self.backend.value,
            "key_id": self._key_id,
            "total_signs": self._sign_count,
            "total_verifies": self._verify_count,
            "fallback": getattr(self, "_fallback", False),
            "fallback_reason": getattr(self, "_fallback_reason", None),
            "persistent": bool(os.getenv("SIGNING_PRIVATE_KEY") or os.getenv("SIGNING_PRIVATE_KEY_B64") or Path(os.getenv("SIGNING_KEY_FILE", str(_SIGNING_KEY_FILE))).exists()),
        }
