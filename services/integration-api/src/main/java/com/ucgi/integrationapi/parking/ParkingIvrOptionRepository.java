package com.ucgi.integrationapi.parking;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ParkingIvrOptionRepository extends JpaRepository<ParkingIvrOption, Long> {

    List<ParkingIvrOption> findAllByOrderByPositionAscIdAsc();
}
