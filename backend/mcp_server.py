from mcp.server.fastmcp import FastMCP
import httpx
from typing import List, Dict, Any, Optional

# Initialize FastMCP Server
mcp = FastMCP("GamifiedBackend")

# Base URL of the existing FastAPI backend
BASE_URL = "http://localhost:8000/api"

@mcp.tool()
async def get_user_stats() -> Dict[str, Any]:
    """Get the current user's streak and sessions."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/me")
        response.raise_for_status()
        return response.json()

@mcp.tool()
async def update_user_stats(streak_add: int = 0, sessions_add: int = 0) -> Dict[str, Any]:
    """Add to the user's streak or sessions. 
    Use streak_add > 0 to increment streak, sessions_add > 0 to increment sessions.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/me/stats", json={"streak_add": streak_add, "sessions_add": sessions_add})
        response.raise_for_status()
        return response.json()

@mcp.tool()
async def get_plan() -> List[Dict[str, Any]]:
    """Retrieve the current study/work plan."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/plan")
        response.raise_for_status()
        return response.json()

@mcp.tool()
async def save_plan(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Save a new set of plan items, replacing incomplete ones.
    items should be a list of dictionaries with 'topic' (str) and 'duration' (int).
    Example: [{"topic": "Read Book", "duration": 30}]
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/plan", json=items)
        response.raise_for_status()
        return response.json()

@mcp.tool()
async def complete_plan_item(item_id: int) -> Dict[str, Any]:
    """Mark a specific plan item as completed by its ID."""
    async with httpx.AsyncClient() as client:
        response = await client.put(f"{BASE_URL}/plan/{item_id}")
        response.raise_for_status()
        return response.json()

@mcp.tool()
async def ai_coach_chat(message: str) -> Dict[str, Any]:
    """Send a message to the AI coach to get motivation and a suggested plan.
    It returns a JSON object with 'reply' (str) and 'plan' (list of items).
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/chat", json={"message": message})
        response.raise_for_status()
        return response.json()

if __name__ == "__main__":
    mcp.run(transport='stdio')
