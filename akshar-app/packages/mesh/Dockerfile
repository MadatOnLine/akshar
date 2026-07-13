FROM node:20-slim

WORKDIR /app

# Copy the local crypto package
COPY packages/crypto/ ./packages/crypto/
WORKDIR /app/packages/crypto
RUN npm install --omit=dev

# Reset workdir to /app before copying mesh
WORKDIR /app

# Copy the mesh package
COPY packages/mesh/ ./packages/mesh/
WORKDIR /app/packages/mesh
RUN npm install --omit=dev

EXPOSE 8003

CMD ["node", "dist/index.js"]
