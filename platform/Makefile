.PHONY: up down logs restart db-migrate db-seed clean ps health

# Start all services in detached mode
up:
	docker-compose up -d

# Start all services with build
up-build:
	docker-compose up -d --build

# Stop all services
down:
	docker-compose down

# View logs for all services (follow mode)
logs:
	docker-compose logs -f

# View logs for a specific service (usage: make logs-service SERVICE=postgres)
logs-service:
	docker-compose logs -f $(SERVICE)

# Restart all services
restart:
	docker-compose restart

# Run database migrations
db-migrate:
	npx prisma migrate dev

# Seed the database
db-seed:
	npx prisma db seed

# Stop services and remove volumes (WARNING: destroys all data)
clean:
	docker-compose down -v

# Show running containers
ps:
	docker-compose ps

# Check health of all services
health:
	@echo "=== PostgreSQL ===" && docker-compose exec postgres pg_isready -U gaming_platform || true
	@echo "=== Redis ===" && docker-compose exec redis redis-cli ping || true
	@echo "=== RabbitMQ ===" && docker-compose exec rabbitmq rabbitmq-diagnostics check_running || true
	@echo "=== Elasticsearch ===" && curl -s http://localhost:9200/_cluster/health | head -c 200 || true
	@echo ""
