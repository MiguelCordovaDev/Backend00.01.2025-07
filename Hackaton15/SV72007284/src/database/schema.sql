CREATE DATABASE IF NOT EXISTS sv43123322_curier CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sv43123322_curier;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(100) UNIQUE,
  username VARCHAR(150),
  display_name VARCHAR(200),
  email VARCHAR(200),
  avatar_url VARCHAR(500),
  provider VARCHAR(50) NOT NULL DEFAULT 'google',
  role ENUM('user','courier','admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_google_id (google_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tracking_number VARCHAR(50) UNIQUE NOT NULL,
  sender_id INT NOT NULL,
  receiver_name VARCHAR(200) NOT NULL,
  receiver_phone VARCHAR(30),
  receiver_address TEXT NOT NULL,
  description TEXT,
  weight DECIMAL(10,2),
  status ENUM('pending','picked_up','in_transit','out_for_delivery','delivered','cancelled') DEFAULT 'pending',
  courier_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP NULL,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (courier_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_tracking (tracking_number),
  INDEX idx_sender (sender_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS package_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id INT NOT NULL,
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  location_name VARCHAR(300),
  description TEXT,
  status VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  INDEX idx_package (package_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id INT,
  sender_id INT NOT NULL,
  receiver_id INT,
  message TEXT NOT NULL,
  type ENUM('notification','chat','system') DEFAULT 'chat',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_package (package_id),
  INDEX idx_sender (sender_id),
  INDEX idx_receiver (receiver_id)
) ENGINE=InnoDB;

DROP FUNCTION IF EXISTS generate_tracking_number;
DELIMITER $$
CREATE FUNCTION generate_tracking_number()
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
  DECLARE tracking VARCHAR(50);
  DECLARE tries INT DEFAULT 0;
  REPEAT
    SET tracking = CONCAT('PKG', LPAD(FLOOR(RAND() * 9999999999), 10, '0'));
    SET tries = tries + 1;
  UNTIL (SELECT COUNT(*) = 0 FROM packages WHERE tracking_number = tracking) OR tries > 20 END REPEAT;
  RETURN tracking;
END$$
DELIMITER ;