#!/usr/bin/env python3
"""
Setup script for DeFiScore Wallet Authentication Backend
"""
import os
import secrets
import subprocess
import sys


def generate_secret_key():
    """Generate cryptographically secure secret key"""
    return secrets.token_urlsafe(64)


def create_env_file():
    """Create .env file from template if it doesn't exist"""
    if os.path.exists('.env'):
        print("✓ .env file already exists")
        return
    
    if not os.path.exists('.env.example'):
        print("✗ .env.example not found")
        return
    
    with open('.env.example', 'r') as f:
        content = f.read()
    
    # Generate new secret key
    secret_key = generate_secret_key()
    content = content.replace('your-secret-key-here-change-in-production', secret_key)
    
    with open('.env', 'w') as f:
        f.write(content)
    
    print("✓ Created .env file with generated SECRET_KEY")


def install_dependencies():
    """Install Python dependencies"""
    print("\nInstalling dependencies...")
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
        print("✓ Dependencies installed successfully")
    except subprocess.CalledProcessError:
        print("✗ Failed to install dependencies")
        sys.exit(1)


def check_redis():
    """Check if Redis is available"""
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=0)
        r.ping()
        print("✓ Redis is running")
        return True
    except Exception:
        print("✓ Using in-memory storage (Redis not configured)")
        return False


def main():
    """Main setup function"""
    print("=" * 60)
    print("DeFiScore Wallet Authentication Backend Setup")
    print("=" * 60)
    
    # Create .env file
    print("\n1. Environment Configuration")
    create_env_file()
    
    # Install dependencies
    print("\n2. Dependencies")
    install_dependencies()
    
    # Check Redis
    print("\n3. Redis Check")
    check_redis()
    
    print("\n" + "=" * 60)
    print("Setup Complete!")
    print("=" * 60)
    print("\nTo start the server:")
    print("  python main.py")
    print("\nAPI Documentation:")
    print("  http://localhost:8000/docs")
    print("=" * 60)


if __name__ == "__main__":
    main()
