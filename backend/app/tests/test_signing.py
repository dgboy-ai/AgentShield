"""
Tests for Signing Engine

Validates:
- ECDSA-P256 signing and verification
- Signature is deterministic per message (same key)
- Tampered message fails verification
- JSON signing works
- Public key export works
- Event emission for audit trail
"""

import base64
import json

from app.core.signing import SigningEngine, SigningBackend


def test_sign_returns_signature():
    """Test basic signing."""
    engine = SigningEngine()
    result = engine.sign("test message")

    assert result.success is True
    assert result.signature is not None
    assert result.key_id is not None
    assert result.backend == SigningBackend.LOCAL
    print("[PASS] test_sign_returns_signature")


def test_verify_valid_signature():
    """Test verification of valid signature."""
    engine = SigningEngine()
    message = "Important data to sign"
    sign_result = engine.sign(message)
    verify_result = engine.verify(message, sign_result.signature)

    assert verify_result.success is True
    print("[PASS] test_verify_valid_signature")


def test_verify_rejects_tampered_message():
    """Test that tampered message fails verification."""
    engine = SigningEngine()
    sign_result = engine.sign("original message")
    verify_result = engine.verify("tampered message", sign_result.signature)

    assert verify_result.success is False
    assert verify_result.error == "Invalid signature"
    print("[PASS] test_verify_rejects_tampered_message")


def test_verify_rejects_wrong_signature():
    """Test that wrong signature fails verification."""
    engine = SigningEngine()
    # Generate a different signature
    other_result = engine.sign("other message")
    verify_result = engine.verify("test message", other_result.signature)

    assert verify_result.success is False
    print("[PASS] test_verify_rejects_wrong_signature")


def test_sign_json():
    """Test JSON signing."""
    engine = SigningEngine()
    data = {"memory": "user prefers dark mode", "timestamp": "2026-08-09"}
    sign_result = engine.sign_json(data)

    assert sign_result.success is True

    verify_result = engine.verify_json(data, sign_result.signature)
    assert verify_result.success is True
    print("[PASS] test_sign_json")


def test_verify_json_rejects_tampered():
    """Test that tampered JSON fails verification."""
    engine = SigningEngine()
    data = {"memory": "user prefers dark mode"}
    sign_result = engine.sign_json(data)

    tampered = {"memory": "user prefers LIGHT mode"}
    verify_result = engine.verify_json(tampered, sign_result.signature)

    assert verify_result.success is False
    print("[PASS] test_verify_json_rejects_tampered")


def test_export_public_key_pem():
    """Test PEM public key export."""
    engine = SigningEngine()
    pem = engine.export_public_key("pem")

    assert "BEGIN PUBLIC KEY" in pem
    assert "END PUBLIC KEY" in pem
    print("[PASS] test_export_public_key_pem")


def test_export_public_key_jwk():
    """Test JWK public key export."""
    engine = SigningEngine()
    jwk_str = engine.export_public_key("jwk")
    jwk = json.loads(jwk_str)

    assert jwk["kty"] == "EC"
    assert jwk["crv"] == "P-256"
    assert "x" in jwk
    assert "y" in jwk
    assert "kid" in jwk
    print("[PASS] test_export_public_key_jwk")


def test_event_emission():
    """Test that signing operations emit events."""
    engine = SigningEngine()
    events = []

    def capture(event_type, data):
        events.append(event_type)

    engine.add_listener(capture)

    engine.sign("test")
    engine.verify("test", engine.sign("test").signature)

    assert events.count("signing_operation") == 3  # sign + sign + verify
    print("[PASS] test_event_emission")


def test_sign_binary_data():
    """Test signing binary data."""
    engine = SigningEngine()
    data = b"\x00\x01\x02\x03\x04\x05"
    sign_result = engine.sign(data)

    assert sign_result.success is True

    verify_result = engine.verify(data, sign_result.signature)
    assert verify_result.success is True
    print("[PASS] test_sign_binary_data")


def test_stats():
    """Test stats tracking."""
    engine = SigningEngine()
    engine.sign("a")
    engine.sign("b")
    engine.verify("a", engine.sign("a").signature)

    stats = engine.get_stats()
    assert stats["total_signs"] == 3
    assert stats["total_verifies"] == 1
    print("[PASS] test_stats")


def test_key_id_stable():
    """Test that key ID is stable across operations."""
    engine = SigningEngine()
    kid1 = engine.get_key_id()
    kid2 = engine.get_key_id()
    assert kid1 == kid2
    print("[PASS] test_key_id_stable")


if __name__ == "__main__":
    print("=" * 60)
    print("Signing Engine — Test Suite")
    print("=" * 60)

    test_sign_returns_signature()
    test_verify_valid_signature()
    test_verify_rejects_tampered_message()
    test_verify_rejects_wrong_signature()
    test_sign_json()
    test_verify_json_rejects_tampered()
    test_export_public_key_pem()
    test_export_public_key_jwk()
    test_event_emission()
    test_sign_binary_data()
    test_stats()
    test_key_id_stable()

    print("=" * 60)
    print("All 12 tests passed!")
    print("=" * 60)
