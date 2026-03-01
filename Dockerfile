FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the project
COPY . .

# Default command for this repo (runs Jest tests)
CMD ["npm", "test"]
