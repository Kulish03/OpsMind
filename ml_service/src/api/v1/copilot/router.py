from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter(prefix="/copilot", tags=["AI Copilot & RAG"])

@router.get("/status")
async def get_copilot_status():
    """Returns the operational status of AI Copilot, Tool Calling, and RAG services."""
    return {
        "status": "operational",
        "llm_provider": "configured_server_side",
        "tools_registered": [
            "get_sales_summary",
            "get_product_velocity",
            "check_inventory_levels",
            "get_expense_breakdown"
        ],
        "rag_vector_search": "ready_for_phase_6",
        "phase": "Phase 0 - Foundation Skeleton",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
