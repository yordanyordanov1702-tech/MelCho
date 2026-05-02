FROM node:20-slim

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Install Python3 and venv
RUN apt-get update && \
    apt-get install -y python3 python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Create isolated venv and install garminconnect inside it (avoids PEP 668)
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install garminconnect -q

# Put venv's python3 first on PATH so Node's execFile finds it
ENV PATH="/opt/venv/bin:$PATH"

# Copy app source
COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
