#!/bin/bash

# Simple deployment script for IoT Data Collection Service
# Clones git repository and deploys using Docker Compose

set -e

echo "================================================="
echo "IoT Data Collection Service - Git Deployment"
echo "================================================="

# Configuration from package.json
REPO_URL="https://github.com/t0x3e8/iot_data_collection_service.git"
DEPLOY_DIR="src"
BRANCH="main"

echo
echo "Configuration:"
echo "  Repository: $REPO_URL"
echo "  Directory:  $DEPLOY_DIR"
echo "  Branch:     $BRANCH"
echo

# Confirm deployment
read -p "Proceed with deployment? (y/n) [y]: " CONFIRM
CONFIRM=${CONFIRM:-y}
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Deployment cancelled."
    exit 0
fi

echo
echo "Starting deployment..."

# Check prerequisites
echo "Checking prerequisites..."
if ! command -v git >/dev/null 2>&1; then
    echo "Error: Git is not installed"
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "Error: Docker is not installed"
    exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1; then
    echo "Error: Docker Compose is not installed"
    exit 1
fi

# Handle existing directory
if [ -d "$DEPLOY_DIR" ]; then
    echo "Directory '$DEPLOY_DIR' already exists."
    read -p "Remove and clone fresh? (y/n) [n]: " OVERWRITE
    OVERWRITE=${OVERWRITE:-n}
    if [ "$OVERWRITE" = "y" ] || [ "$OVERWRITE" = "Y" ]; then
        echo "Removing existing directory..."
        rm -rf "$DEPLOY_DIR"
    else
        echo "Using existing directory. Pulling latest changes..."
        cd "$DEPLOY_DIR"
        git fetch origin
        git checkout "$BRANCH"
        git pull origin "$BRANCH"
        cd ..
    fi
fi

# Clone repository if needed
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "Cloning repository..."
    git clone -b "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
    echo "Repository cloned successfully."
fi

# Change to deployment directory
cd "$DEPLOY_DIR"

# Create .env file
echo "Setting up environment configuration..."

if [ ! -f ".env.example" ]; then
    echo "Error: .env.example file not found in repository"
    exit 1
fi

if [ -f ".env" ]; then
    echo ".env file already exists."
    read -p "Overwrite existing .env file? (y/n) [n]: " OVERWRITE_ENV
    OVERWRITE_ENV=${OVERWRITE_ENV:-n}
    if [ "$OVERWRITE_ENV" = "y" ] || [ "$OVERWRITE_ENV" = "Y" ]; then
        cp .env.example .env
        echo "Created new .env file from .env.example"
    else
        echo "Keeping existing .env file."
    fi
else
    cp .env.example .env
    echo "Created .env file from .env.example"
fi

# Prompt to edit .env
echo
echo "IMPORTANT: Review and modify the .env file before deployment."
echo "Update database credentials, security settings, and other configuration values."
echo
read -p "Do you want to edit the .env file now? (y/n) [y]: " EDIT_ENV
EDIT_ENV=${EDIT_ENV:-y}

if [ "$EDIT_ENV" = "y" ] || [ "$EDIT_ENV" = "Y" ]; then
    if command -v nano >/dev/null 2>&1; then
        nano .env
    elif command -v vim >/dev/null 2>&1; then
        vim .env
    elif command -v vi >/dev/null 2>&1; then
        vi .env
    else
        echo "No text editor found. Please edit .env manually."
        echo "Press Enter to continue when you're done editing..."
        read
    fi
fi

# Read EXTERNAL_PORT from .env and update docker-compose.yml if needed
EXTERNAL_PORT=$(grep "^EXTERNAL_PORT=" .env | cut -d '=' -f2 | tr -d ' ')
EXTERNAL_PORT=${EXTERNAL_PORT:-3000}

echo "Using external port $EXTERNAL_PORT..."
# Note: docker-compose.yml now uses EXTERNAL_PORT environment variable, no need to modify file

# Final confirmation
echo
read -p "Start Docker deployment? (y/n) [y]: " DEPLOY_CONFIRM
DEPLOY_CONFIRM=${DEPLOY_CONFIRM:-y}

if [ "$DEPLOY_CONFIRM" != "y" ] && [ "$DEPLOY_CONFIRM" != "Y" ]; then
    echo "Docker deployment skipped. Run 'docker-compose up -d' manually when ready."
    exit 0
fi

# Check if Docker is running
if ! sudo docker info >/dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Deploy with Docker Compose
echo "Stopping any existing containers..."
sudo docker-compose down 2>/dev/null || true

echo "Note: If you changed database credentials, you may need to remove the database volume."
read -p "Remove existing database volume? (y/n) [n]: " REMOVE_DB_VOLUME
REMOVE_DB_VOLUME=${REMOVE_DB_VOLUME:-n}

if [ "$REMOVE_DB_VOLUME" = "y" ] || [ "$REMOVE_DB_VOLUME" = "Y" ]; then
    echo "Removing database volume..."
    sudo docker-compose down -v 2>/dev/null || true
fi

echo "Building and starting containers..."
sudo docker-compose up -d --build

echo "Waiting for services to start..."
sleep 10

# Check if application is running
echo "Checking application health on port $EXTERNAL_PORT..."
for i in {1..15}; do
    if curl -f http://127.0.0.1:$EXTERNAL_PORT/health >/dev/null 2>&1; then
        echo "Application is running successfully!"
        break
    else
        if [ $i -eq 15 ]; then
            echo "Warning: Application health check failed. Check logs with: docker-compose logs app"
        else
            echo "Waiting for application to start..."
            sleep 2
        fi
    fi
done

echo
echo "================================================="
echo "Deployment completed!"
echo "================================================="
echo "Application URL: http://127.0.0.1:$EXTERNAL_PORT"
echo "Health Check:    http://127.0.0.1:$EXTERNAL_PORT/health"
echo "Database:        MySQL on 127.0.0.1:3306"
echo
echo "Useful commands:"
echo "  View logs:     sudo docker-compose logs -f"
echo "  Stop services: sudo docker-compose down"
echo "  Restart:       sudo docker-compose restart"
echo "================================================="
