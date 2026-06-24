# Makefile — atajos del proyecto UCGI

.PHONY: help up down logs restart build ps clean test lint sonar sonar-up sonar-api sonar-crm certs stress coverage-api coverage-crm
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

coverage-api: ## Cobertura JaCoCo del integration-api → target/site/jacoco/
	cd services/integration-api && ./mvnw -B verify

coverage-crm: ## Cobertura v8 del CRM → coverage/lcov.info
	cd services/crm-frontend && npm run test:coverage

sonar: sonar-api sonar-crm ## Análisis SonarQube completo (Java + TS)

sonar-up: ## Asegura SonarQube + DB UP healthy en http://localhost:9000
	docker compose up -d sonar sonar-db
	@echo "Esperando SonarQube en http://localhost:9000 (~60s primer arranque)..."
	@until curl -sf http://localhost:9000/api/system/status >/dev/null 2>&1; do sleep 3; done
	@echo "SonarQube UP."

sonar-api: sonar-up ## Análisis SonarQube del integration-api (Java + JaCoCo)
	@test -n "$$SONAR_TOKEN" || (echo "ERROR: exportá SONAR_TOKEN (http://localhost:9000 → Administration → Security → Users → Tokens)"; exit 1)
	cd services/integration-api && ./mvnw -B verify org.sonarsource.scanner.maven:sonar-maven-plugin:sonar \
		-Dsonar.host.url=http://localhost:9000 \
		-Dsonar.login=$$SONAR_TOKEN

sonar-crm: sonar-up coverage-crm ## Análisis SonarQube del CRM (TypeScript + lcov)
	@test -n "$$SONAR_TOKEN" || (echo "ERROR: exportá SONAR_TOKEN (http://localhost:9000 → Administration → Security → Users → Tokens)"; exit 1)
	@command -v sonar-scanner >/dev/null 2>&1 || { echo "ERROR: sonar-scanner no instalado; npm i -g sonarqube-scanner"; exit 1; }
	cd services/crm-frontend && sonar-scanner \
		-Dsonar.host.url=http://localhost:9000 \
		-Dsonar.login=$$SONAR_TOKEN

stress: ## Pruebas de carga SIPp (50 cc)
	./tests/load/run-stress.sh

clean: ## Limpia artefactos de build
	cd services/integration-api && ./mvnw clean
	cd services/crm-frontend && rm -rf dist node_modules/.vite
