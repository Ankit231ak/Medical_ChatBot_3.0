# Use Node base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy full project
COPY . .

# Build frontend
RUN npm run build

# Expose backend port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]