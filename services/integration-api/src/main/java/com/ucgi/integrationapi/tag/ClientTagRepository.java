package com.ucgi.integrationapi.tag;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ClientTagRepository extends JpaRepository<ClientTag, Long> {

    List<ClientTag> findAllByOrderByNameAsc();

    @Query(value = """
            SELECT t.* FROM client_tags t
              JOIN client_tag_assignments a ON a.tag_id = t.id
             WHERE a.client_id = :clientId
             ORDER BY t.name ASC
            """, nativeQuery = true)
    List<ClientTag> findByClientId(@Param("clientId") Long clientId);

    @Modifying
    @Query(value = "DELETE FROM client_tag_assignments WHERE client_id = :clientId",
            nativeQuery = true)
    void clearAssignmentsForClient(@Param("clientId") Long clientId);

    @Modifying
    @Query(value = """
            INSERT IGNORE INTO client_tag_assignments (client_id, tag_id)
            VALUES (:clientId, :tagId)
            """, nativeQuery = true)
    void assignTag(@Param("clientId") Long clientId, @Param("tagId") Long tagId);
}
