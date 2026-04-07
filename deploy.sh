#!/bin/bash
set -e

# CivicText Deployment Script
# Usage: ./deploy.sh [staging|production] [image-tag]

ENVIRONMENT=${1:-staging}
IMAGE_TAG=${2:-latest}
IMAGE_NAME="ghcr.io/your-org/civictext:${IMAGE_TAG}"

echo "=== CivicText Deployment ==="
echo "Environment: $ENVIRONMENT"
echo "Image: $IMAGE_NAME"

if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo "Error: .env.$ENVIRONMENT not found"
    exit 1
fi

# Load environment variables
export $(cat ".env.$ENVIRONMENT" | xargs)

# Pull latest image
echo "Pulling image..."
docker pull "$IMAGE_NAME"

# Stop existing containers
echo "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down || true

# Start services
echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for app to be healthy
echo "Waiting for app to be healthy..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker compose -f docker-compose.prod.yml exec -T app wget --quiet --tries=1 --spider http://localhost:3000/ 2>/dev/null; then
        echo "App is healthy!"
        break
    fi
    attempt=$((attempt + 1))
    echo "Health check attempt $attempt/$max_attempts..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "Warning: App failed health check after $max_attempts attempts"
    docker compose -f docker-compose.prod.yml logs app
    exit 1
fi

echo "=== Deployment Complete ==="
docker compose -f docker-compose.prod.yml ps
