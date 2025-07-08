#!/bin/bash

# Check if all required arguments are provided
if [ "$#" -ne 5 ]; then
    echo "Usage: $0 [registry_url] [image_name] [tag] [container_name] [host_port:container_port]"
    echo "Example: $0 172.17.0.2:5000 iot_data_collection_service v1.0.0 iot_app 3000:3000"
    exit 1
fi

# Set variables from arguments
REGISTRY_URL="$1"
IMAGE_NAME="$2"
TAG="$3"
CONTAINER_NAME="$4"
PORTS="$5"

echo "Deploying $IMAGE_NAME:$TAG from $REGISTRY_URL"
echo "Container: $CONTAINER_NAME on ports $PORTS"

# Step 1: Pull the Docker Image
echo "Step 1: Pulling Docker image..."
sudo docker pull "$REGISTRY_URL/$IMAGE_NAME:$TAG"

# Step 2: Stop and remove existing Container
echo "Step 2: Stopping and removing existing container..."
sudo docker stop $CONTAINER_NAME 2>/dev/null && sudo docker rm $CONTAINER_NAME 2>/dev/null

# Step 3: Run the Docker Container
echo "Step 3: Running new Docker container..."
sudo docker run -d --name $CONTAINER_NAME -p $PORTS "$REGISTRY_URL/$IMAGE_NAME:$TAG"

echo "Successfully deployed $CONTAINER_NAME on ports $PORTS"
