"""
Session manager for storing user data, form history, and preferences locally.
Uses JSON files for simple persistent storage.
"""
import json
import os
from typing import Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

STORAGE_DIR = "storage"
SESSIONS_FILE = os.path.join(STORAGE_DIR, "sessions.json")
FORM_DATA_FILE = os.path.join(STORAGE_DIR, "form_data.json")
HISTORY_FILE = os.path.join(STORAGE_DIR, "history.json")


class SessionManager:
    """Manages user sessions and persistent data storage."""
    
    def __init__(self):
        self._ensure_storage_dir()
        self.sessions: Dict[str, Dict] = self._load_json(SESSIONS_FILE)
        self.form_data: Dict[str, Dict] = self._load_json(FORM_DATA_FILE)
        self.history: Dict[str, list] = self._load_json(HISTORY_FILE)
    
    def _ensure_storage_dir(self):
        """Create storage directory if it doesn't exist."""
        if not os.path.exists(STORAGE_DIR):
            os.makedirs(STORAGE_DIR)
            logger.info(f"Created storage directory: {STORAGE_DIR}")
    
    def _load_json(self, filepath: str) -> Dict:
        """Load JSON file or return empty dict."""
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading {filepath}: {e}")
                return {}
        return {}
    
    def _save_json(self, filepath: str, data: Dict):
        """Save data to JSON file."""
        try:
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving {filepath}: {e}")
    
    # Session Management
    
    def create_session(self, client_id: str, user_data: Optional[Dict] = None) -> Dict:
        """Create a new session for a client."""
        session = {
            "client_id": client_id,
            "created_at": datetime.now().isoformat(),
            "language": "en",
            "user_data": user_data or {},
            "current_task": None
        }
        self.sessions[client_id] = session
        self._save_json(SESSIONS_FILE, self.sessions)
        logger.info(f"Created session for client: {client_id}")
        return session
    
    def get_session(self, client_id: str) -> Optional[Dict]:
        """Get session data for a client."""
        return self.sessions.get(client_id)
    
    def update_session(self, client_id: str, updates: Dict):
        """Update session data."""
        if client_id in self.sessions:
            self.sessions[client_id].update(updates)
            self._save_json(SESSIONS_FILE, self.sessions)
    
    def delete_session(self, client_id: str):
        """Delete a session."""
        if client_id in self.sessions:
            del self.sessions[client_id]
            self._save_json(SESSIONS_FILE, self.sessions)
    
    # Form Data Storage
    
    def save_form_data(self, form_id: str, data: Dict):
        """
        Save form data for reuse.
        form_id: Unique identifier for the form (e.g., URL or form name)
        """
        self.form_data[form_id] = {
            "data": data,
            "last_used": datetime.now().isoformat()
        }
        self._save_json(FORM_DATA_FILE, self.form_data)
        logger.info(f"Saved form data for: {form_id}")
    
    def get_form_data(self, form_id: str) -> Optional[Dict]:
        """Retrieve saved form data."""
        form_entry = self.form_data.get(form_id)
        if form_entry:
            return form_entry.get("data")
        return None
    
    def list_saved_forms(self) -> list:
        """List all saved forms."""
        return [
            {
                "form_id": form_id,
                "last_used": entry.get("last_used")
            }
            for form_id, entry in self.form_data.items()
        ]
    
    # Browsing History
    
    def add_to_history(self, client_id: str, entry: Dict):
        """
        Add an entry to browsing history.
        entry: {"url": str, "title": str, "timestamp": str, "action": str}
        """
        if client_id not in self.history:
            self.history[client_id] = []
        
        entry["timestamp"] = datetime.now().isoformat()
        self.history[client_id].append(entry)
        
        # Keep only last 100 entries
        if len(self.history[client_id]) > 100:
            self.history[client_id] = self.history[client_id][-100:]
        
        self._save_json(HISTORY_FILE, self.history)
    
    def get_history(self, client_id: str, limit: int = 50) -> list:
        """Get browsing history for a client."""
        history = self.history.get(client_id, [])
        return history[-limit:]
    
    def clear_history(self, client_id: str):
        """Clear browsing history for a client."""
        if client_id in self.history:
            self.history[client_id] = []
            self._save_json(HISTORY_FILE, self.history)
    
    # User Preferences
    
    def save_user_preference(self, client_id: str, key: str, value: Any):
        """Save a user preference."""
        session = self.get_session(client_id)
        if session:
            if "preferences" not in session:
                session["preferences"] = {}
            session["preferences"][key] = value
            self._save_json(SESSIONS_FILE, self.sessions)
    
    def get_user_preference(self, client_id: str, key: str, default: Any = None) -> Any:
        """Get a user preference."""
        session = self.get_session(client_id)
        if session and "preferences" in session:
            return session["preferences"].get(key, default)
        return default
