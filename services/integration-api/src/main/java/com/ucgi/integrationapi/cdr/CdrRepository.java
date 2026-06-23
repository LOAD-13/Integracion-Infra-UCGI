package com.ucgi.integrationapi.cdr;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CdrRepository extends JpaRepository<Cdr, Long>, JpaSpecificationExecutor<Cdr> {

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
