# Makefile — atajos del proyecto UCGI

.PHONY: help up down logs restart build ps clean test lint sonar certs stress
.DEFAULT_GOAL := help

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Levanta todo el stack (perfil prod)
	docker compose up -d --build

up-dev: ## Levanta con overrides de desarrollo
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

down: ## Detiene y elimina contenedores (conserva volúmenes)
	docker compose down

down-clean: ## Detiene y elimina contenedores + volúmenes (¡borra datos!)
	docker compose down -v

logs: ## Muestra logs en seguimiento
	docker compose logs -f --tail=100

ps: ## Lista contenedores
	docker compose ps

restart: ## Reinicia todos los servicios
	docker compose restart

build: ## Build de todas las imágenes
	docker compose build

certs: ## Genera certificados autofirmados
	./scripts/generate-certs.sh

test: ## Ejecuta tests de api y crm
	cd services/integration-api && ./mvnw test
	cd services/crm-frontend && npm test

lint: ## Lint del frontend
	cd services/crm-frontend && npm run lint

sonar: ## Lanza análisis SonarQube
	docker compose up -d sonar sonar-db
	cd services/integration-api && ./mvnw sonar:sonar
	cd services/crm-frontend && npm run sonar

stress: ## Pruebas de carga SIPp (50 cc)
	./tests/load/run-stress.sh

clean: ## Limpia artefactos de build
	cd services/integration-api && ./mvnw clean
	cd services/crm-frontend && rm -rf dist node_modules/.vite
