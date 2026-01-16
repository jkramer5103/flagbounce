# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install uv for faster package management
RUN pip install --no-cache-dir uv

# Copy dependency files
COPY pyproject.toml uv.lock* ./

# Install dependencies using uv
RUN uv pip install --system -r pyproject.toml

# Copy application files
COPY server.py .
COPY index.html .
COPY admin.html .
COPY game.js .
COPY styles.css .
COPY assets/ ./assets/

# Expose port 5000
EXPOSE 5000

# Set environment variables
ENV FLASK_APP=server.py
ENV PYTHONUNBUFFERED=1

# Run the Flask application
CMD ["python", "server.py"]
