"""
Google Custom Search Engine (CSE) integration.
Fetches recent web context to enrich Gemini prompts with up-to-date information.
"""

import httpx
from app.config import CSE_API_KEY, CSE_ENGINE_ID

# Google Custom Search API endpoint
CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1"


async def search_web(query: str, num_results: int = 3) -> str:
    """
    Search the web using Google Custom Search Engine API.
    
    Args:
        query: The search query string.
        num_results: Number of results to return (max 10).
    
    Returns:
        Formatted string of search snippets, or empty string if CSE is not configured.
    """
    if not CSE_API_KEY or not CSE_ENGINE_ID:
        return ""  # Silently skip if not configured

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                CSE_ENDPOINT,
                params={
                    "key": CSE_API_KEY,
                    "cx": CSE_ENGINE_ID,
                    "q": query,
                    "num": min(num_results, 10),
                },
            )
            resp.raise_for_status()
            data = resp.json()

        # Extract and format results
        items = data.get("items", [])
        if not items:
            return ""

        snippets = []
        for item in items[:num_results]:
            title = item.get("title", "")
            snippet = item.get("snippet", "")
            link = item.get("link", "")
            snippets.append(f"• {title}: {snippet} (Source: {link})")

        return "\n".join(snippets)

    except (httpx.HTTPError, httpx.TimeoutException, KeyError) as e:
        # Fail silently — the AI can still respond without web context
        print(f"[CSE Warning] Search failed: {e}")
        return ""


def should_search_web(query: str) -> bool:
    """
    Heuristic to decide if a query needs recent web context.
    
    Returns True if the query likely asks about:
    - Recent publications, trends, or news
    - Specific current events or releases
    - Topics that change frequently
    """
    recent_keywords = [
        "latest", "recent", "new", "2024", "2025", "2026",
        "trending", "just released", "upcoming", "current",
        "this year", "modern", "contemporary", "best sellers",
        "popular now", "top rated",
    ]
    query_lower = query.lower()
    return any(keyword in query_lower for keyword in recent_keywords)
