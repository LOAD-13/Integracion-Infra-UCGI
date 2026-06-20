package com.ucgi.integrationapi.client;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ClientRepository extends JpaRepository<Client, Long> {

    /**
     * Búsqueda case-insensitive sobre nombre, teléfono, email o empresa con
     * filtro opcional por agente asignado (tabla {@code agent_assignments}).
     * Cuando ambos parámetros son {@code null} equivale a {@code findAll(pageable)}.
     *
     * <p>El join con {@code agent_assignments} solo se activa si
     * {@code agentUserId} no es nulo — así no degradamos el plan de la query
     * cuando el filtro no se usa.
     */
    @Query(value = """
            SELECT c.* FROM clients c
            WHERE ( :q IS NULL
                 OR LOWER(c.name)    LIKE LOWER(CONCAT('%', :q, '%'))
                 OR LOWER(c.phone)   LIKE LOWER(CONCAT('%', :q, '%'))
                 OR LOWER(COALESCE(c.email,''))   LIKE LOWER(CONCAT('%', :q, '%'))
                 OR LOWER(COALESCE(c.company,'')) LIKE LOWER(CONCAT('%', :q, '%')) )
              AND ( :agentUserId IS NULL
                 OR EXISTS (
                     SELECT 1 FROM agent_assignments a
                     WHERE a.client_id = c.id
                       AND a.agent_user_id = :agentUserId
                 ) )
            """,
            countQuery = """
            SELECT COUNT(*) FROM clients c
            WHERE ( :q IS NULL
                 OR LOWER(c.name)    LIKE LOWER(CONCAT('%', :q, '%'))
                 OR LOWER(c.phone)   LIKE LOWER(CONCAT('%', :q, '%'))
                 OR LOWER(COALESCE(c.email,''))   LIKE LOWER(CONCAT('%', :q, '%'))
                 OR LOWER(COALESCE(c.company,'')) LIKE LOWER(CONCAT('%', :q, '%')) )
              AND ( :agentUserId IS NULL
                 OR EXISTS (
                     SELECT 1 FROM agent_assignments a
                     WHERE a.client_id = c.id
                       AND a.agent_user_id = :agentUserId
                 ) )
            """,
            nativeQuery = true)
    Page<Client> search(@Param("q") String q,
                        @Param("agentUserId") Long agentUserId,
                        Pageable pageable);
}
