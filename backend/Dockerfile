# Production Dockerfile for CodeGuard Express Server

FROM node:20-slim

# Install docker client inside backend if backend needs to run docker sibling commands (Docker-in-Docker / Sibling-Docker)
# For local standard deployments, Express runs directly, but this file is container ready.

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

# Create temp folder for local runner fallbacks
RUN mkdir -p temp && chmod 777 temp

EXPOSE 5000

ENV NODE_ENV=production

CMD ["npm", "start"]
