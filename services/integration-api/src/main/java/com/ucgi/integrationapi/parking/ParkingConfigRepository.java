package com.ucgi.integrationapi.parking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ParkingConfigRepository extends JpaRepository<ParkingConfig, Short> {
}
