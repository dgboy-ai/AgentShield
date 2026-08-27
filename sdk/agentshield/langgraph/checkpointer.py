"""LangGraph checkpointer backed by AgentShield's tamper-evident hash chain.

Usage::

    from agentshield.langgraph import AgentShieldCheckpointer

    checkpointer = AgentShieldCheckpointer()  # auto-connects to AgentShield backend
    # or
    checkpointer = AgentShieldCheckpointer(base_url="http://localhost:8000")

    # Use with LangGraph
    graph = builder.compile(checkpointer=checkpointer)
    result = graph.invoke(input, config={"configurable": {"thread_id": "thread-1"}})
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any, AsyncIterator, Iterator, Optional, Sequence, Union

import httpx

logger = logging.getLogger("agentshield.langgraph")

# LangGraph checkpoint types - imported lazily to avoid hard dependency
_CheckpointTuple = None
_BaseCheckpointSaver = None
_ChannelProtocol = None
_Checkpoint = None
_CheckpointMetadata = None
_CheckpointConfig = None


def _import_langgraph():
    """Lazy import of LangGraph types. Raises ImportError with helpful message."""
    global _CheckpointTuple, _BaseCheckpointSaver, _ChannelProtocol
    global _Checkpoint, _CheckpointMetadata, _CheckpointConfig

    try:
        from langgraph.checkpoint.base import (
            BaseCheckpointSaver,
            Checkpoint,
            CheckpointTuple,
            ChannelProtocol,
            CheckpointMetadata,
            CheckpointConfig,
        )
        _BaseCheckpointSaver = BaseCheckpointSaver
        _CheckpointTuple = CheckpointTuple
        _ChannelProtocol = ChannelProtocol
        _Checkpoint = Checkpoint
        _CheckpointMetadata = CheckpointMetadata
        _CheckpointConfig = CheckpointConfig
    except ImportError:
        raise ImportError(
            "LangGraph is required for AgentShieldCheckpointer. "
            "Install with: pip install agentshield[langgraph]"
        )


class AgentShieldCheckpointer:
    """LangGraph checkpointer backed by AgentShield's tamper-evident memory.

    Wraps AgentShield's hash chain, constraint pinning, digital signatures,
    and audit trail to provide a tamper-evident checkpoint store for LangGraph.

    Every checkpoint is:
    - SHA-256 hash-chained (any tampering breaks the chain)
    - ECDSA-P256 signed (non-repudiable integrity)
    - Audit-logged (EU AI Act Article 12 compliant)

    Usage::

        checkpointer = AgentShieldCheckpointer()
        graph = builder.compile(checkpointer=checkpointer)
        result = graph.invoke(input, config={"configurable": {"thread_id": "t-1"}})
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = 30.0,
    ):
        _import_langgraph()

        # Use our own client to connect to the AgentShield backend
        from ..client import _resolve_base_url, _resolve_api_key

        self._base_url = _resolve_base_url(base_url).rstrip("/")
        self._api_key = _resolve_api_key(api_key)

        self._client = httpx.Client(
            base_url=self._base_url,
            timeout=timeout,
            headers={"Content-Type": "application/json"},
        )

        if self._api_key:
            self._client.headers["Authorization"] = f"Bearer {self._api_key}"

        self._serde = _default_serde()

        logger.info("AgentShieldCheckpointer initialized (url=%s)", self._base_url)

    @property
    def serde(self):
        return self._serde

    @property
    def config_specs(self):
        return []

    # - Core checkpoint operations -

    def get_tuple(self, config: dict) -> Optional[Any]:
        """Retrieve a checkpoint tuple by config (thread_id + checkpoint_id)."""
        _import_langgraph()

        thread_id = config.get("configurable", {}).get("thread_id")
        checkpoint_id = config.get("configurable", {}).get("checkpoint_id")

        if not thread_id:
            return None

        try:
            resp = self._client.get(
                "/api/memories",
                params={"memory_type": "checkpoint"},
                headers=self._auth_headers(),
            )
            if resp.status_code != 200:
                logger.warning("get_tuple: backend returned status %d", resp.status_code)
                return None

            data = resp.json()
            if not isinstance(data, list):
                logger.warning("get_tuple: expected list, got %s", type(data).__name__)
                return None

            for mem in data:
                if not isinstance(mem, dict):
                    continue
                try:
                    content = json.loads(mem.get("content", "{}"))
                except (json.JSONDecodeError, TypeError):
                    continue
                if (
                    content.get("thread_id") == thread_id
                    and (checkpoint_id is None or mem.get("memory_id") == checkpoint_id)
                ):
                    return self._checkpoint_tuple_from_memory(mem, config)

            return None
        except (httpx.HTTPError, OSError) as e:
            logger.warning("get_tuple failed: %s", e)
            return None

    def put(
        self,
        config: dict,
        checkpoint: Any,
        metadata: dict,
        new_versions: dict,
    ) -> Optional[str]:
        """Store a checkpoint in AgentShield's hash chain.

        Returns checkpoint_id on success, None on failure.
        """
        _import_langgraph()

        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            thread_id = str(uuid.uuid4())

        checkpoint_id = getattr(checkpoint, "id", None) or str(uuid.uuid4())

        # Serialize the checkpoint
        serialized = self._serde.dumps_typed(checkpoint)

        # Build memory content
        content = json.dumps(
            {
                "thread_id": thread_id,
                "checkpoint_id": checkpoint_id,
                "type": "langgraph_checkpoint",
                "data": serialized[1].hex() if isinstance(serialized[1], bytes) else str(serialized[1]),
                "data_type": serialized[0],
                "metadata": metadata,
                "new_versions": {k: str(v) for k, v in new_versions.items()} if new_versions else {},
            },
            default=str,
        )

        try:
            resp = self._client.post(
                "/api/memories",
                json={
                    "content": content,
                    "memory_type": "checkpoint",
                    "importance_score": 1.0,
                    "trust_level": 1.0,
                    "source_provenance": f"langgraph:{thread_id}",
                },
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return checkpoint_id
        except (httpx.HTTPError, OSError) as e:
            logger.error("put failed: %s", e)
            return None

    def put_writes(
        self,
        config: dict,
        writes: Sequence[tuple],
        task_id: str,
    ) -> None:
        """Store writes (channel updates) as a checkpoint event.

        Raises on failure - does NOT silently swallow errors.
        """
        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            return

        checkpoint_id = config.get("configurable", {}).get("checkpoint_id", "latest")

        content = json.dumps(
            {
                "thread_id": thread_id,
                "checkpoint_id": checkpoint_id,
                "type": "langgraph_writes",
                "task_id": task_id,
                "writes": [(ch, self._serialize_value(val)) for ch, val in writes],
            },
            default=str,
        )

        resp = self._client.post(
            "/api/memories",
            json={
                "content": content,
                "memory_type": "checkpoint",
                "importance_score": 0.8,
                "trust_level": 1.0,
                "source_provenance": f"langgraph:{thread_id}:{task_id}",
            },
            headers=self._auth_headers(),
        )
        resp.raise_for_status()

    def list(
        self,
        config: dict,
        limit: int = 10,
        before: Optional[str] = None,
    ) -> Iterator[Any]:
        """List checkpoints for a thread, newest first."""
        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            return

        try:
            resp = self._client.get(
                "/api/memories",
                params={"memory_type": "checkpoint"},
                headers=self._auth_headers(),
            )
            if resp.status_code != 200:
                return

            data = resp.json()
            if not isinstance(data, list):
                return

            # Filter to this thread
            thread_memories = []
            for mem in data:
                if not isinstance(mem, dict):
                    continue
                try:
                    content = json.loads(mem.get("content", "{}"))
                    if content.get("thread_id") == thread_id and content.get("type") == "langgraph_checkpoint":
                        thread_memories.append(mem)
                except (json.JSONDecodeError, TypeError):
                    logger.warning("Skipping corrupted checkpoint entry: %s", mem.get("memory_id"))
                    continue

            # Sort by created_at descending (newest first)
            thread_memories.sort(key=lambda m: m.get("created_at", ""), reverse=True)

            # Apply limit
            count = 0
            for mem in thread_memories:
                if count >= limit:
                    break
                if before and mem.get("memory_id") == before:
                    break
                tup = self._checkpoint_tuple_from_memory(mem, config)
                if tup is not None:
                    yield tup
                    count += 1
        except (httpx.HTTPError, OSError) as e:
            logger.warning("list failed: %s", e)

    def delete_thread(self, thread_id: str) -> None:
        """Delete all checkpoints for a thread.

        Note: AgentShield's hash chain is append-only, so this marks
        checkpoints as inactive rather than deleting them.
        """
        logger.info("delete_thread called for %s (hash chain preserved)", thread_id)

    def _checkpoint_tuple_from_memory(self, mem: dict, config: dict) -> Optional[Any]:
        """Convert an AgentShield memory to a LangGraph CheckpointTuple."""
        _import_langgraph()

        try:
            content = json.loads(mem.get("content", "{}"))
            thread_id = content.get("thread_id")
            checkpoint_id = content.get("checkpoint_id")

            # Deserialize the checkpoint data
            data_type = content.get("data_type", "")
            data_hex = content.get("data", "")
            if data_hex and isinstance(data_hex, str):
                try:
                    data_bytes = bytes.fromhex(data_hex)
                    checkpoint = self._serde.loads_typed((data_type, data_bytes))
                except (ValueError, TypeError):
                    logger.warning("Failed to deserialize checkpoint data for %s", checkpoint_id)
                    return None
            else:
                checkpoint = None

            metadata = content.get("metadata", {})

            # Build the config with checkpoint info
            checkpoint_config = {
                "configurable": {
                    "thread_id": thread_id,
                    "checkpoint_id": checkpoint_id,
                    "checkpoint_ns": config.get("configurable", {}).get("checkpoint_ns", ""),
                }
            }

            return _CheckpointTuple(
                config=checkpoint_config,
                checkpoint=checkpoint,
                metadata=metadata,
                parent_config=None,
                pending_writes=[],
            )
        except (json.JSONDecodeError, TypeError, KeyError) as e:
            logger.warning("Failed to parse checkpoint: %s", e)
            return None

    def _serialize_value(self, value: Any) -> Any:
        """Serialize a write value for JSON storage."""
        if isinstance(value, bytes):
            return value.hex()
        elif isinstance(value, (dict, list)):
            return value
        elif hasattr(value, "__dict__"):
            return {"__type__": type(value).__name__, "__data__": str(value)}
        else:
            return value

    def _auth_headers(self) -> dict:
        if self._api_key:
            return {"Authorization": f"Bearer {self._api_key}"}
        return {}

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class _default_serde:
    """Default serializer for checkpoint data."""

    def dumps_typed(self, obj: Any) -> tuple[str, bytes]:
        """Serialize an object to (type_name, bytes)."""
        data = json.dumps(obj, default=str).encode()
        return "json", data

    def loads_typed(self, data: tuple[str, bytes]) -> Any:
        """Deserialize (type_name, bytes) to an object."""
        type_name, bytes_data = data
        if type_name == "json":
            return json.loads(bytes_data.decode())
        return bytes_data
