package com.ucgi.integrationapi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class IntegrationApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(IntegrationApiApplication.class, args);
    }
}
