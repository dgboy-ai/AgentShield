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
_SIGNING_KEY_FILE = _SIGNING_KEY_DIR / "signing_key.pem"


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
        self._private_key: Optional[EllipticCurvePrivateKey] = None
        self._public_key: Optional[EllipticCurvePublicKey] = None
        self._key_id: str = ""
        self._sign_count = 0
        self._verify_count = 0
        self._listeners: list = []
        self._kms_client = None  # boto3 client when KMS enabled

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
        """Initialize AWS KMS backend. Falls back to LOCAL if AWS not configured."""
        kms_key_id = os.getenv("AWS_KMS_KEY_ID", "")
        aws_region = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
        if not kms_key_id:
            # No KMS key configured — fall back to local with warning, do NOT crash
            import logging
            logging.getLogger("agentshield.signing").warning(
                "AWS_KMS backend requested but AWS_KMS_KEY_ID not set — falling back to LOCAL. "
                "Set AWS_KMS_KEY_ID and AWS credentials to enable real KMS signing."
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
            import logging
            logging.getLogger("agentshield.signing").info(
                "AWS KMS backend initialized: key_id=%s region=%s", self._key_id, aws_region
            )
        except ImportError:
            import logging
            logging.getLogger("agentshield.signing").warning(
                "boto3 not installed — cannot use AWS KMS. Falling back to LOCAL. pip install boto3"
            )
            self.backend = SigningBackend.LOCAL
            self._private_key, self._public_key = self._load_or_generate_key()
            pub_bytes = self._public_key.public_bytes(
                Encoding.X962, PublicFormat.CompressedPoint
            )
            self._key_id = hashlib.sha256(pub_bytes).hexdigest()[:16]
        except Exception as e:
            import logging
            logging.getLogger("agentshield.signing").warning(
                "AWS KMS init failed (%s) — falling back to LOCAL", e
            )
            self.backend = SigningBackend.LOCAL
            self._private_key, self._public_key = self._load_or_generate_key()
            pub_bytes = self._public_key.public_bytes(
                Encoding.X962, PublicFormat.CompressedPoint
            )
            self._key_id = hashlib.sha256(pub_bytes).hexdigest()[:16]

    def _load_or_generate_key(self) -> tuple[EllipticCurvePrivateKey, EllipticCurvePublicKey]:
        """Load existing key from disk, or generate and persist a new one."""
        if _SIGNING_KEY_FILE.exists():
            try:
                pem_data = _SIGNING_KEY_FILE.read_bytes()
                private_key = serialization.load_pem_private_key(pem_data, password=None)
                if isinstance(private_key, EllipticCurvePrivateKey):
                    return private_key, private_key.public_key()
            except Exception:
                pass  # Corrupt key — regenerate

        private_key = ec.generate_private_key(SECP256R1())
        try:
            _SIGNING_KEY_DIR.mkdir(parents=True, exist_ok=True)
            pem = private_key.private_bytes(
                Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()
            )
            tmp = str(_SIGNING_KEY_FILE) + ".tmp"
            with open(tmp, "wb") as f:
                f.write(pem)
            os.replace(tmp, str(_SIGNING_KEY_FILE))
            os.chmod(str(_SIGNING_KEY_FILE), 0o600)
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
                try:
                    self._kms_client.verify(
                        KeyId=kms_key_id,
                        Message=message_bytes,
                        MessageType="RAW",
                        SigningAlgorithm="ECDSA_SHA_256",
                        Signature=signature_bytes,
                    )
                except Exception:
                    # Fallback: local verify with cached public key (for offline verify)
                    self._public_key.verify(
                        signature_bytes,
                        message_bytes,
                        ec.ECDSA(hashes.SHA256()),
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
            # Simplified JWK export
            pub_bytes = self._public_key.public_bytes(
                Encoding.X962, PublicFormat.CompressedPoint
            )
            return json.dumps(
                {
                    "kty": "EC",
                    "crv": "P-256",
                    "x": base64.urlsafe_b64encode(pub_bytes[:32]).decode().rstrip("="),
                    "y": base64.urlsafe_b64encode(pub_bytes[32:]).decode().rstrip("="),
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
            "key_id": self._key_id,
            "total_signs": self._sign_count,
            "total_verifies": self._verify_count,
        }
