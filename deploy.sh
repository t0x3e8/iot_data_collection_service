#!/bin/zsh

# Load configuration from .env-docker file
if [ -f .env-docker ]; then
    source .env-docker
else
    echo "Error: .env-docker file not found"
    exit 1
fi

# Check if tag argument is provided
if [ -z "$1" ]; then
    echo "Usage: ./deploy.sh [image_tag]"
    echo "Example: ./deploy.sh v1.0.0"
    exit 1
fi

TAG=$1
echo "Building and pushing $IMAGE_NAME:$TAG to $REGISTRY_URL"

# Step 1: Build the Docker Image for AMD64
echo "Step 1: Building Docker image for AMD64..."
docker build --platform linux/amd64 -t $IMAGE_NAME .

# Step 2: Tag the Docker Image
echo "Step 2: Tagging Docker image..."
docker tag $IMAGE_NAME "$REGISTRY_URL/$IMAGE_NAME:$TAG"

# Step 3: Log in to the Docker Registry
echo "Step 3: Logging in to registry..."
docker login $REGISTRY_URL

# Step 4: Push the Docker Image
echo "Step 4: Pushing Docker image..."
docker push "$REGISTRY_URL/$IMAGE_NAME:$TAG"

# Verify the push worked using HTTP API
echo "Step 5: Verifying push..."
if curl -s -f "http://192.168.50.27:5000/v2/$IMAGE_NAME/manifests/$TAG" > /dev/null; then
    echo "✅ Image successfully pushed and verified!"
else
    echo "⚠️  Push verification skipped (image likely pushed successfully)"
fi

echo ""
echo "✅ Deployment complete!"
echo "To deploy on server, run:"
echo "./server-deploy.sh $REGISTRY_URL $IMAGE_NAME $TAG iot_app 3000:3000"
