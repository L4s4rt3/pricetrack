FROM debian:bookworm-slim

ENV PYTHONUNBUFFERED=1
ENV HOME=/tmp

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-calc \
    python3 \
    python3-uno \
    fonts-dejavu \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.py /app/server.py

EXPOSE 8080
CMD ["python3", "/app/server.py"]
