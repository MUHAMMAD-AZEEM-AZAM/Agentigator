"""
Browser automation tools for the Gemini agent.
These tools are called by the agent and executed on the mobile app.
"""


def load_url(url: str) -> dict:
    """
    Load a URL in the browser.
    
    Args:
        url (str): The URL to load
    
    Returns:
        dict: Status and message
    """
    return {
        "tool": "load_url",
        "params": {"url": url},
        "description": f"Loading {url}"
    }


def click_element(selector: str, description: str = "") -> dict:
    """
    Click an element on the page.
    
    Args:
        selector (str): CSS selector or description of element to click
        description (str): Human-readable description of what's being clicked
    
    Returns:
        dict: Status and message
    """
    return {
        "tool": "click_element",
        "params": {
            "selector": selector,
            "description": description
        },
        "description": f"Clicking {description or selector}"
    }


def type_text(selector: str, text: str, description: str = "") -> dict:
    """
    Type text into an input field.
    
    Args:
        selector (str): CSS selector of the input field
        text (str): Text to type
        description (str): Human-readable description of the field
    
    Returns:
        dict: Status and message
    """
    return {
        "tool": "type_text",
        "params": {
            "selector": selector,
            "text": text,
            "description": description
        },
        "description": f"Typing into {description or selector}"
    }


def scroll_page(direction: str = "down", amount: int = 300) -> dict:
    """
    Scroll the page.
    
    Args:
        direction (str): "up" or "down"
        amount (int): Pixels to scroll
    
    Returns:
        dict: Status and message
    """
    return {
        "tool": "scroll_page",
        "params": {
            "direction": direction,
            "amount": amount
        },
        "description": f"Scrolling {direction}"
    }


def go_back() -> dict:
    """
    Go back in browser history.
    
    Returns:
        dict: Status and message
    """
    return {
        "tool": "go_back",
        "params": {},
        "description": "Going back"
    }


def go_forward() -> dict:
    """
    Go forward in browser history.
    
    Returns:
        dict: Status and message
    """
    return {
        "tool": "go_forward",
        "params": {},
        "description": "Going forward"
    }


def refresh_page() -> dict:
    """
    Refresh the current page.
    
    Returns:
        dict: Status and message
    """
    return {
        "tool": "refresh_page",
        "params": {},
        "description": "Refreshing page"
    }


def get_page_info() -> dict:
    """
    Request current page information and screenshot.
    The mobile app will capture and send back page state.
    
    Returns:
        dict: Status and message
    """
    return {
        "tool": "get_page_info",
        "params": {},
        "description": "Getting page information"
    }
