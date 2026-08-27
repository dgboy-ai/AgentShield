"""AgentShield LangGraph integration.

Provides:
- `AgentShieldCheckpointer`: Tamper-evident checkpoint store for LangGraph
- `scan_input_node`: Graph node that scans user input for poisoning attacks
"""

from __future__ import annotations

from typing import Any, TypedDict

from .checkpointer import AgentShieldCheckpointer


class AgentShieldState(TypedDict, total=False):
    """State dict for the scan_input_node."""
    input: str
    blocked: bool
    scan_result: dict | None
    error: str | None


def scan_input_node(state: dict, fail_closed: bool = False) -> dict:
    """LangGraph graph node that scans user input for poisoning attacks.

    Add this node BEFORE your agent node to block malicious inputs:

        from agentshield.langgraph import scan_input_node, AgentShieldCheckpointer

        graph = StateGraph(MessagesState)
        graph.add_node("scan_input", scan_input_node)
        graph.add_node("agent", call_agent)
        graph.add_edge(START, "scan_input")
        graph.add_conditional_edges("scan_input", route_scan_result)
        graph.add_edge("agent", END)

    If the input is blocked, the node sets `blocked=True` and `scan_result`
    with the full scan details. Your routing function should check `blocked`
    and either halt or pass through to the agent.

    Args:
        state: The current graph state. Must contain "input" key.
        fail_closed: If True, block input when backend is unreachable.
                     If False (default), allow input through on failure.
                     Set to True in high-security environments.

    The node uses the AgentShield public scan endpoint (no auth required)
    for zero-config usage.
    """
    import httpx

    input_text = state.get("input", "")
    if not input_text:
        return {"blocked": False, "scan_result": None, "error": None}

    # Use the AgentShield backend's public scan endpoint
    # This requires no auth - it's the same endpoint used by WebMCP
    try:
        from ..client import _resolve_base_url
        base_url = _resolve_base_url()

        resp = httpx.post(
            f"{base_url.rstrip('/')}/api/public/scan",
            json={"text": input_text},
            timeout=5.0,
        )

        if resp.status_code == 200:
            result = resp.json()
            return {
                "blocked": result.get("blocked", False),
                "scan_result": result,
                "error": None,
            }
        else:
            # Scan endpoint returned an error
            if fail_closed:
                return {
                    "blocked": True,
                    "scan_result": None,
                    "error": f"Scan failed with status {resp.status_code} (fail-closed)",
                }
            return {
                "blocked": False,
                "scan_result": None,
                "error": f"Scan failed with status {resp.status_code}",
            }
    except (httpx.ConnectError, httpx.TimeoutException, OSError) as e:
        # Network/connection errors only - let programming errors propagate
        if fail_closed:
            return {
                "blocked": True,
                "scan_result": None,
                "error": f"AgentShield unreachable: {e} (fail-closed)",
            }
        return {
            "blocked": False,
            "scan_result": None,
            "error": f"AgentShield unreachable: {e}",
        }


def route_scan_result(state: dict) -> str:
    """Routing function for conditional edges after scan_input_node.

    Usage::

        graph.add_conditional_edges("scan_input", route_scan_result, {
            "blocked": "error_handler",
            "safe": "agent",
        })
    """
    if state.get("blocked"):
        return "blocked"
    return "safe"


__all__ = [
    "AgentShieldCheckpointer",
    "AgentShieldState",
    "scan_input_node",
    "route_scan_result",
]
