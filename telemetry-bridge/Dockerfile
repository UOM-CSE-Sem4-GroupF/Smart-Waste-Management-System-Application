FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir kafka-python requests python-dotenv
COPY bridge.py .
CMD ["python", "-u", "bridge.py"]
