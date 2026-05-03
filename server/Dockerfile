# Stage 1: install Python packages using official Python image
FROM python:3.11-slim AS python-builder
RUN pip install garminconnect --target /python_deps --no-cache-dir -q

# Stage 2: Node.js runtime with Python packages copied in
FROM node:20-slim
WORKDIR /app

# Copy pre-installed Python packages
COPY --from=python-builder /python_deps /app/python_deps

# Install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Make sure Python is available for garmin_fetch.py
RUN apt-get update && apt-get install -y python3 --no-install-recommends && rm -rf /var/lib/apt/lists/*

EXPOSE 3000
CMD ["node", "app.js"]
