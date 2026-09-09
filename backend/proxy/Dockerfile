# VCA proxy — 멀티스테이지 빌드 (UV-60). 빌드 컨텍스트 = backend/proxy, 결과 이미지는 JRE + fat jar 하나.
# 로컬 개발은 여전히 ./gradlew bootRun — 이 파일은 개발서버/운영 배포용(deploy/docker-compose.yml)이다.
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /src
# 의존성 해석을 소스보다 먼저 캐시 — 소스만 바뀌면 gradle 배포판·의존성 다운로드를 다시 하지 않는다
COPY gradlew build.gradle settings.gradle ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon -q dependencies > /dev/null 2>&1 || true
COPY src src
RUN ./gradlew --no-daemon -q bootJar -x test \
 && cp "$(ls build/libs/*.jar | grep -v plain | head -1)" /app.jar

FROM eclipse-temurin:21-jre-alpine
# curl — compose healthcheck(actuator/health)용
RUN apk add --no-cache curl && adduser -D -u 10001 vca
USER vca
COPY --from=build /app.jar /app/app.jar
EXPOSE 8080
ENV TZ=UTC JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
