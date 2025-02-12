# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Ensure correct ownership
# Run as root to fix permissions first
USER root

# Ensure directories exist and set proper ownership
#RUN mkdir -p /app/user-sessions /app/.dist && \
#    chown -R pptruser:pptruser /app && \
#    chmod -R 777 /app/.dist /app/user-sessions
#
#USER pptruser


COPY package*.json .

RUN npm install

COPY . .

RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Ensure directory exists with correct permissions
USER root

# Ensure directories exist and set proper ownership
#RUN mkdir -p /app/user-sessions /app/.dist && \
#    chown -R pptruser:pptruser /app && \
#    chmod -R 777 /app/.dist /app/user-sessions
#
#USER pptruser

COPY package*.json .

RUN npm install --production

COPY --from=build /app/.dist ./.dist

CMD ["node", ".dist/app.js"]
