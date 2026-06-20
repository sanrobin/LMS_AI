"""
AI Assistant route — integrates Gemini with optional Google Custom Search.

Workflow:
1. Student sends a message
2. Backend checks if web search is needed (heuristic)
3. If yes, calls CSE API for recent context
4. Constructs enriched prompt with catalog + CSE context
5. Sends to Gemini → returns response
"""

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Book, User
from app.schemas import ChatRequest, ChatResponse
from app.auth.dependencies import get_current_user
from app.services.gemini_service import get_gemini_response
from app.services.search_service import search_web, should_search_web

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Chat with the AI Library Assistant.
    Enriches student queries with library catalog context and optional web search results.
    """
    try:
        # 1. Get all books from catalog for context
        books = db.query(Book).all()
        book_list = [
            {
                "title": b.title,
                "author": b.author,
                "isbn": b.isbn or "N/A",
                "status": b.status.value,
            }
            for b in books
        ]

        # 2. Optionally search the web for recent context
        search_context = ""
        sources = []
        if should_search_web(data.message):
            search_context = await search_web(f"books about {data.message}")
            if search_context:
                # Extract source URLs for citation
                for line in search_context.split("\n"):
                    if "Source: " in line:
                        url = line.split("Source: ")[-1].rstrip(")")
                        sources.append(url)

        # 3. Call Gemini with enriched context
        # Run sync Gemini call in thread pool to avoid blocking
        reply = await asyncio.to_thread(
            get_gemini_response,
            user_message=data.message,
            available_books=book_list,
            search_context=search_context,
        )

        return ChatResponse(reply=reply, sources=sources if sources else None)

    except Exception as e:
        print(f"[AI Error] {e}")
        raise HTTPException(
            status_code=500,
            detail="The AI assistant encountered an error. Please try again.",
        )
