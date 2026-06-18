package com.ucgi.integrationapi;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.MountableFile;

/**
 * Base de tests de integración: levanta UN solo contenedor MariaDB compartido
 * por toda la suite (singleton vía bloque estático) con el esquema y seed
 * reales montados desde {@code src/test/resources/db/init/}.
 */
@SpringBootTest
@Testcontainers
public abstract class AbstractIntegrationTest {

    protected static final MariaDBContainer<?> MARIADB = new MariaDBContainer<>("mariadb:10.6")
            .withDatabaseName("crm")
            .withUsername("ucgi_app")
            .withPassword("changeme-app")
            .withCopyFileToContainer(
                    MountableFile.forClasspathResource("db/init/01-schemas.sql"),
                    "/docker-entrypoint-initdb.d/01-schemas.sql")
            .withCopyFileToContainer(
                    MountableFile.forClasspathResource("db/init/02-crm-tables.sql"),
                    "/docker-entrypoint-initdb.d/02-crm-tables.sql")
            .withCopyFileToContainer(
                    MountableFile.forClasspathResource("db/init/03-seed-data.sql"),
                    "/docker-entrypoint-initdb.d/03-seed-data.sql");

    static {
        MARIADB.start();
    }

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MARIADB::getJdbcUrl);
        registry.add("spring.datasource.username", MARIADB::getUsername);
        registry.add("spring.datasource.password", MARIADB::getPassword);
    }
}
