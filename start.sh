#!/bin/bash
# Simple script to run Ambient Study Companion in a container

CONTAINER_NAME="ambient-companion"
IMAGE_NAME="ambient-companion"
PORT="5000"
SECRET_KEY="${FLASK_SECRET_KEY:-change-me-to-something-secure}"

# Check if container is already running
if podman ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "Container '${CONTAINER_NAME}' already exists."
    echo "Starting existing container..."
    podman start ${CONTAINER_NAME}
else
    echo "Creating and starting new container..."
    podman run -d \
        --name ${CONTAINER_NAME} \
        -p ${PORT}:5000 \
        -e FLASK_SECRET_KEY="${SECRET_KEY}" \
        -v "$(pwd)/data:/data:z" \
        --restart unless-stopped \
        ${IMAGE_NAME}
fi

echo ""
echo "✓ Ambient Study Companion is running!"
echo "  Access it at: http://localhost:${PORT}"
echo ""
echo "Commands:"
echo "  Stop:    podman stop ${CONTAINER_NAME}"
echo "  Logs:    podman logs -f ${CONTAINER_NAME}"
echo "  Restart: podman restart ${CONTAINER_NAME}"
echo "  Remove:  podman rm -f ${CONTAINER_NAME}"
