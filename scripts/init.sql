-- This script will run inside the container on startup
-- Creates a user that can connect from any IP
CREATE DATABASE IF NOT EXISTS iot_data;
CREATE USER IF NOT EXISTS 'iot_user'@'%' IDENTIFIED BY 'iot_password';
GRANT ALL PRIVILEGES ON iot_data.* TO 'iot_user'@'%';
FLUSH PRIVILEGES;
