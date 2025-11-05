FROM docker.io/python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl tzdata ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

ENV FLASK_APP=app.py \
    PORT=5000 \
    AC_DATA_DIR=/data

EXPOSE 5000

CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000"]


