FROM python:3.13-slim

WORKDIR /app

COPY pyproject.toml README.md ./
COPY configs ./configs
COPY features ./features
COPY inference ./inference
COPY models ./models
COPY training ./training
COPY scripts ./scripts

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -e .

EXPOSE 8001

CMD ["python", "scripts/tasks.py", "run-api"]

