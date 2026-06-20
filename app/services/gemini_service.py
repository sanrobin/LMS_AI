"""
Google Gemini API integration for the AI Library Assistant.

Sends structured prompts with library catalog context and optional
web search results to produce helpful book recommendations.
"""

import google.generativeai as genai
from app.config import GEMINI_API_KEY

# ── System prompt ───────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an AI Library Assistant for a school/university library.
Your role is to help students discover and learn about books available in the library.

Guidelines:
- When recommending books, PRIORITIZE books from the "Available Books" list provided.
- Suggest similar books that students might also enjoy.
- Provide short, concise summaries and explanations of recommended books.
- Keep your tone friendly, helpful, and strictly related to library resources and academic topics.
- If a student asks something unrelated to books or the library, politely redirect them.
- Format your responses with clear structure: use bullet points, bold text for titles, and keep paragraphs short.
- When listing books, indicate if they are AVAILABLE in the library or just general recommendations.
"""


def get_gemini_response(
    user_message: str,
    available_books: list[dict],
    search_context: str = ""
) -> str:
    """
    Generate a response from Gemini with library catalog context.
    
    Args:
        user_message: The student's question or topic.
        available_books: List of dicts with book info from the database.
        search_context: Optional web search snippets for recent information.
    
    Returns:
        Gemini's text response string.
    
    Raises:
        ValueError: If GEMINI_API_KEY is not configured.
    """
    if not GEMINI_API_KEY:
        return ("⚠️ The AI Assistant is not configured yet. "
                "Please ask the librarian to set up the Gemini API key in the .env file.")

    # Configure the SDK
    genai.configure(api_key=GEMINI_API_KEY)

    # Build catalog context
    catalog_text = _format_catalog(available_books)

    # Build the enriched prompt
    prompt_parts = [
        f"Student's question: {user_message}\n",
    ]

    if search_context:
        prompt_parts.append(
            f"Recent web context (from Google Search, use this for up-to-date info):\n{search_context}\n"
        )

    prompt_parts.append(
        f"Available books in our library:\n{catalog_text}\n"
    )

    prompt_parts.append(
        "Based on the above, provide a helpful response. "
        "Recommend relevant books from the library catalog first, "
        "then suggest additional titles. Include a brief summary for each recommendation."
    )

    full_prompt = "\n".join(prompt_parts)

    # Call Gemini
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=SYSTEM_PROMPT,
    )

    response = model.generate_content(full_prompt)
    return response.text


def _format_catalog(books: list[dict]) -> str:
    """Format the book catalog list for the prompt."""
    if not books:
        return "No books currently in the catalog."

    lines = []
    for b in books[:50]:  # Limit to 50 books to stay within token limits
        status = "✅ Available" if b.get("status") == "available" else "📖 Borrowed"
        lines.append(f"- \"{b['title']}\" by {b['author']} (ISBN: {b.get('isbn', 'N/A')}) [{status}]")

    return "\n".join(lines)
