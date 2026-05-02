FROM node:20-slim

# Install Python 3 and pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Install Python dependencies
RUN pip3 install garminconnect --break-system-packages

# Copy app source
COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
