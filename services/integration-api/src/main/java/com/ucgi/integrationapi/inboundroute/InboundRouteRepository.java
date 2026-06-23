package com.ucgi.integrationapi.inboundroute;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InboundRouteRepository extends JpaRepository<InboundRoute, Long> {

    List<InboundRoute> findAllByOrderByPriorityAscIdAsc();
}
