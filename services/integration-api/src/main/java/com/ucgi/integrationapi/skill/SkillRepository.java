package com.ucgi.integrationapi.skill;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface SkillRepository extends JpaRepository<Skill, Long> {

    List<Skill> findAllByOrderByNameAsc();

    @Query(value = """
            SELECT s.* FROM skills s
              JOIN skill_agents sa ON sa.skill_id = s.id
             WHERE sa.user_id = :userId
             ORDER BY s.name ASC
            """, nativeQuery = true)
    List<Skill> findByAgentUserId(@Param("userId") Long userId);

    @Query(value = "SELECT user_id FROM skill_agents WHERE skill_id = :skillId ORDER BY priority DESC, user_id ASC",
            nativeQuery = true)
    List<Long> findAgentIds(@Param("skillId") Long skillId);

    @Modifying
    @Query(value = "DELETE FROM skill_agents WHERE skill_id = :skillId", nativeQuery = true)
    void clearAgents(@Param("skillId") Long skillId);

    @Modifying
    @Query(value = """
            INSERT INTO skill_agents (skill_id, user_id, priority) VALUES (:skillId, :userId, :priority)
              ON DUPLICATE KEY UPDATE priority = VALUES(priority)
            """, nativeQuery = true)
    void assignAgent(@Param("skillId") Long skillId,
                     @Param("userId") Long userId,
                     @Param("priority") int priority);

    @Query(value = "SELECT COUNT(*) FROM skill_agents WHERE skill_id = :skillId", nativeQuery = true)
    long countAgents(@Param("skillId") Long skillId);
}
