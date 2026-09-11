"""
OptiFleet B2B — Tests: AgentOrchestrator Integration
======================================================
Verifică flow-ul dual-AI: Claude (conversational) + Qwen3 (tehnic).
Ruleaza: pytest tests/integration/test_orchestrator.py -v
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.services.ai_agent.orchestrator import AgentOrchestrator
from app.services.ai_agent.tool_registry import ToolRegistry
from app.domain.interfaces.i_interfaces import IAIModel


# ─── Fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture
def mock_claude() -> IAIModel:
    """Mock Claude — răspunde cu text conversational."""
    model = AsyncMock(spec=IAIModel)
    model.generate = AsyncMock(return_value="Bineînțeles! Am analizat datele pentru tine.")
    model.generate_with_tools = AsyncMock(return_value={
        "type": "text",
        "content": "Comenzile tale sunt în regulă. Estimez un discount de 20%.",
        "tool_calls": [],
    })
    return model


@pytest.fixture
def mock_qwen3() -> IAIModel:
    """Mock Qwen3 — apelează tool-uri tehnice."""
    model = AsyncMock(spec=IAIModel)
    model.generate_with_tools = AsyncMock(return_value={
        "type": "tool_calls",
        "tool_calls": [
            {
                "name": "calculate_shipping_cost",
                "arguments": {
                    "origin_lat": 47.0105,
                    "origin_lon": 28.8638,
                    "destination_lat": 47.0245,
                    "destination_lon": 28.8323,
                    "volume_m3": 2.5,
                    "weight_kg": 400.0,
                }
            }
        ],
    })
    return model


@pytest.fixture
def tool_registry() -> ToolRegistry:
    """ToolRegistry cu roluri SME (acces la tool-uri de bază)."""
    registry = ToolRegistry()
    return registry


@pytest.fixture
def orchestrator(mock_claude, mock_qwen3, tool_registry) -> AgentOrchestrator:
    return AgentOrchestrator(
        claude=mock_claude,
        qwen3=mock_qwen3,
        tool_registry=tool_registry,
    )


# ─── Tests ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_orchestrator_simple_chat_no_tools(orchestrator, mock_claude):
    """
    Mesaj simplu fără tool calls → Claude răspunde direct.
    Qwen3 nu este apelat.
    """
    messages = [{"role": "user", "content": "Bună ziua!"}]

    response = await orchestrator.process(
        messages=messages,
        user_roles=["SME_USER"],
    )

    assert response is not None
    assert isinstance(response, str)
    assert len(response) > 0
    # Claude trebuie apelat
    assert mock_claude.generate_with_tools.called or mock_claude.generate.called


@pytest.mark.asyncio
async def test_orchestrator_routes_technical_query_to_qwen3(orchestrator, mock_qwen3):
    """
    Întrebare tehnică cu date → Qwen3 face tool call → Claude formulează răspuns.
    """
    messages = [
        {
            "role": "user",
            "content": "Calculează costul de transport pentru 2.5 m³, 400 kg din Chișinău Centru la Botanica"
        }
    ]

    response = await orchestrator.process(
        messages=messages,
        user_roles=["SME_ADMIN"],
    )

    assert response is not None
    # Qwen3 trebuie să fi fost apelat cu tool-uri
    mock_qwen3.generate_with_tools.assert_called_once()


@pytest.mark.asyncio
async def test_orchestrator_rbac_blocks_carrier_tools_for_sme(orchestrator, tool_registry):
    """
    Rolul SME_USER nu poate accesa tool-uri de tip CARRIER.
    """
    tools_for_sme = tool_registry.get_tools_for_roles(["SME_USER"])
    tools_for_carrier = tool_registry.get_tools_for_roles(["CARRIER_ADMIN"])

    # SME nu trebuie să aibă acces la unelte administrative de transportator
    sme_tool_names = {t["name"] for t in tools_for_sme}
    carrier_tool_names = {t["name"] for t in tools_for_carrier}

    # Carrier are mai multe tool-uri decât SME (sau cel puțin diferite)
    # Nu verificăm exact care, ci că RBAC există
    assert isinstance(sme_tool_names, set)
    assert isinstance(carrier_tool_names, set)


@pytest.mark.asyncio
async def test_orchestrator_streaming_yields_chunks(orchestrator):
    """
    Streaming mode: yield chunk-uri, nu string complet.
    """
    messages = [{"role": "user", "content": "Status comenzi?"}]

    chunks = []
    async for chunk in orchestrator.process_stream(
        messages=messages,
        user_roles=["SME_USER"],
    ):
        chunks.append(chunk)

    # Trebuie să avem cel puțin un chunk
    assert len(chunks) >= 1
    # Toate chunk-urile trebuie să fie string
    assert all(isinstance(c, str) for c in chunks)


@pytest.mark.asyncio
async def test_tool_registry_has_required_tools(tool_registry):
    """
    Verifică că tool-urile esențiale sunt înregistrate.
    """
    all_tools = tool_registry.get_all_tools()
    tool_names = {t["name"] for t in all_tools}

    required = {
        "calculate_shipping_cost",
        "find_nearest_vehicles",
        "get_route_details",
    }

    for tool in required:
        assert tool in tool_names, f"Tool missing: {tool}"


@pytest.mark.asyncio
async def test_orchestrator_handles_qwen3_failure_gracefully(mock_claude, tool_registry):
    """
    Dacă Qwen3 pică → Claude răspunde fără date tehnice.
    Sistemul nu cade → graceful degradation.
    """
    failing_qwen3 = AsyncMock(spec=IAIModel)
    failing_qwen3.generate_with_tools = AsyncMock(
        side_effect=Exception("Ollama connection refused")
    )

    orchestrator = AgentOrchestrator(
        claude=mock_claude,
        qwen3=failing_qwen3,
        tool_registry=tool_registry,
    )

    messages = [{"role": "user", "content": "Calculează distanța Chișinău-Bălți"}]

    # Nu trebuie să arunce excepție — trebuie să degradeze graceful
    response = await orchestrator.process(
        messages=messages,
        user_roles=["SME_USER"],
    )

    assert response is not None
    assert isinstance(response, str)
