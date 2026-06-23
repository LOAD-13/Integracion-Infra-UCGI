package com.ucgi.integrationapi.campaign;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CampaignContactRepository extends JpaRepository<CampaignContact, Long> {

    List<CampaignContact> findByCampaignIdOrderByPositionAscIdAsc(Long campaignId);

    @Query("""
            SELECT c FROM CampaignContact c
             WHERE c.campaignId = :campaignId AND c.status = :status
             ORDER BY c.position ASC, c.id ASC
            """)
    List<CampaignContact> findByCampaignAndStatus(@Param("campaignId") Long campaignId,
                                                  @Param("status") CampaignContact.Status status);

    long countByCampaignIdAndStatus(Long campaignId, CampaignContact.Status status);
}
