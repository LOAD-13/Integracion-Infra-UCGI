package com.ucgi.integrationapi.campaign;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CampaignRepository extends JpaRepository<Campaign, Long> {

    List<Campaign> findByOwnerUserIdOrderByCreatedAtDesc(Long ownerUserId);

    List<Campaign> findAllByOrderByCreatedAtDesc();
}
