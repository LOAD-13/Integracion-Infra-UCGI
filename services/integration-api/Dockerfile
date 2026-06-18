# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build ----------
FROM eclipse-temurin:17-jdk-jammy AS builder
WORKDIR /workspace

# Aprovecha cache de capas: primero solo pom + wrapper, luego src
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline

COPY src ./src
RUN ./mvnw -B -q -DskipTests package \
 && cp target/integration-api.jar /workspace/app.jar

# ---------- Stage 2: runtime ----------
FROM eclipse-temurin:17-jre-jammy AS runtime

RUN addgroup --system --gid 1001 ucgi \
 && adduser --system --uid 1001 --ingroup ucgi --home /app --no-create-home ucgi \
 && mkdir -p /app && chown -R ucgi:ucgi /app

WORKDIR /app
COPY --from=builder --chown=ucgi:ucgi /workspace/app.jar /app/app.jar

USER ucgi
EXPOSE 8081

ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8081/actuator/health | grep -q '"status":"UP"' || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
