# Utiliser une image Deno officielle
FROM denoland/deno:alpine-1.35.3

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers nécessaires
COPY . .

# Exposer le port utilisé par le backend
EXPOSE 443

# Commande pour exécuter le serveur
# CMD ["run", "--allow-net", "--allow-read", "--watch", "back_server.ts", "3000"]
CMD ["run", "--allow-net", "--allow-read", "--allow-env", "--watch", "back_server.ts", "443"]


