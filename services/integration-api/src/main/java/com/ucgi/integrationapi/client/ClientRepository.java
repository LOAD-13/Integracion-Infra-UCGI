package com.ucgi.integrationapi.client;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ClientRepository extends JpaRepository<Client, Long> {

    /**
     * Búsqueda case-insensitive sobre nombre, teléfono, email o empresa. Cuando
     * {@code q} es {@code null} o vacío, equivale a {@code findAll(pageable)}.
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT c FROM Client c
            WHERE :q IS NULL
               OR LOWER(c.name)    LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(c.phone)   LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(COALESCE(c.email,'')) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(COALESCE(c.company,'')) LIKE LOWER(CONCAT('%', :q, '%'))
            """)
    Page<Client> search(@org.springframework.data.repository.query.Param("q") String q,
                        Pageable pageable);
}
