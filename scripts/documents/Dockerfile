FROM node:24-bookworm-slim
WORKDIR /worker
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY scripts/documents/clamd.mjs scripts/documents/worker.mjs scripts/documents/run.mjs ./scripts/documents/
USER node
CMD ["node", "scripts/documents/run.mjs"]
