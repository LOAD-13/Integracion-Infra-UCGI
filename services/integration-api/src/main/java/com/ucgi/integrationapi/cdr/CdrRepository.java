package com.ucgi.integrationapi.cdr;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CdrRepository extends JpaRepository<Cdr, Long>, JpaSpecificationExecutor<Cdr> {

    Optional<Cdr> findByCallId(String callId);

    /**
     * CDR del agente sumando tanto los que él originó (agent_user_id = :userId)
     * como las llamadas INTERNAS donde fue el extremo destino (alguien lo
     * llamó a su extensión interna). Esto evita que el agente que ATIENDE
     * llamadas internas quede sin métricas.
     */
    @Query(value = """
            SELECT * FROM cdr
             WHERE start_time BETWEEN :from AND :to
               AND ( agent_user_id = :userId
                  OR ( direction = 'INTERNAL' AND callee_number = :extension )
                  OR ( direction = 'INBOUND'  AND callee_number = :extension ) )
            """, nativeQuery = true)
    java.util.List<Cdr> findForAgentInRange(
            @Param("userId") Long userId,
            @Param("extension") String extension,
            @Param("from") java.time.LocalDateTime from,
            @Param("to") java.time.LocalDateTime to);

    @Query(value = """
            SELECT * FROM cdr
             WHERE  ( agent_user_id = :userId
                   OR ( direction = 'INTERNAL' AND callee_number = :extension )
                   OR ( direction = 'INBOUND'  AND callee_number = :extension ) )
             ORDER BY start_time DESC
             LIMIT :max
            """, nativeQuery = true)
    java.util.List<Cdr> findRecentForAgent(
            @Param("userId") Long userId,
            @Param("extension") String extension,
            @Param("max") int max);

    /**
     * TMO (tiempo medio de operacion) en segundos de las llamadas atendidas
     * por el agente. Devuelve null si el agente no tiene llamadas con duracion.
     */
    @Query(value = """
            SELECT AVG(duration_seconds) FROM cdr
             WHERE agent_user_id = :agentUserId
               AND disposition = 'ANSWERED'
               AND duration_seconds > 0
            """, nativeQuery = true)
    Double averageDurationSecondsForAgent(@Param("agentUserId") Long agentUserId);
}
