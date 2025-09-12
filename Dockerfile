# === STAGE 1: Build the Go application using official Go image based on Debian Bullseye
FROM golang:1.22-bullseye AS builder

# Install git (needed if your project or dependencies use Go modules from Git repos)
# Clean apt cache afterward to keep image small
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container to /app
WORKDIR /app

# Copy only go.mod (and optionally go.sum) to leverage Docker layer caching
COPY go.mod ./

# Download all Go module dependencies
RUN go mod download

# Copy the rest of the source code into the container
COPY . .

# Build the Go binary:
# - CGO_ENABLED=0 disables C code dependencies to improve compatibility
# - GOOS=linux ensures it runs in Linux containers
# - GOARCH=amd64 targets 64-bit Linux systems
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o main .

# === STAGE 2: Minimal final runtime image using Alpine Linux
FROM alpine:latest

# Set working directory inside runtime container
WORKDIR /app

# Copy the compiled binary from the build stage
COPY --from=builder /app/main .

# Copy only necessary runtime assets (static files, templates, etc.)
COPY --from=builder /app/frontend ./frontend
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/errorMessages ./errorMessages
COPY --from=builder /app/fonts ./fonts

# Expose port 8081 so Docker can map it to host port
EXPOSE 8081

# Set the default command to run the app
CMD ["./main"]
