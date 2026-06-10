import os

# Zero-dependency .env parser to automatically load GEMINI_API_KEY
env_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), '.env')
if os.path.exists(env_path):
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    # Clean up quotes and set env variable
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
    except Exception as e:
        print(f"Warning: Could not parse .env file: {e}")

class Config:
    """Base configuration class."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'plantora-super-secret-key-12983')
    
    # SQLite fallback, PostgreSQL in production (configurable via environment variable)
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', 
        'sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(__file__)), 'plantora.db')
    )
    # Fix for newer Heroku/Render PostgreSQL URIs that start with postgres://
    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # AI Config
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
    GOOGLE_CLOUD_STORAGE_BUCKET = os.environ.get('GCS_BUCKET_NAME', 'plantora-ai-photos')
