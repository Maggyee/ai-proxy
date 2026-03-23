FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY server.mjs ./

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.mjs"]
