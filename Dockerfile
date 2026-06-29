FROM node:24-alpine AS frontend
WORKDIR /workspace
COPY front/package*.json ./front/
RUN cd front && npm ci
COPY front ./front
COPY back/src/main/resources ./back/src/main/resources
RUN cd front && npm run build

FROM maven:3.9-eclipse-temurin-17 AS backend
WORKDIR /workspace
COPY pom.xml .
COPY back ./back
COPY --from=frontend /workspace/back/src/main/resources/static ./back/src/main/resources/static
RUN mvn -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
ENV SERVER_PORT=8080
COPY --from=backend /workspace/target/brainhack-*.jar /app/brainhack.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/brainhack.jar"]
