# apostas: build com Vite e serve o estático com nginx
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# valores padrão = projeto oficina; no Easypanel dá para sobrescrever em Build Args
ARG VITE_SUPABASE_URL=https://xqilzpbivuvmjjmrgsdx.supabase.co
ARG VITE_SUPABASE_KEY=sb_publishable_7FFaV3odebR6pDWhYZbtwA_aNFcJ4pu
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_KEY=$VITE_SUPABASE_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
