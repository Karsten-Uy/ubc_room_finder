-- DROPING TABLES
DROP TABLE IF EXISTS Bookings CASCADE;
DROP TABLE IF EXISTS Rooms CASCADE;

-- Table for Rooms
CREATE TABLE Rooms (
    room_number INT,
    building VARCHAR(50),
    capacity INT,
    feautures VARCHAR(1000),
    PRIMARY KEY (room_number,building)
);

-- Table for Bookings
CREATE TABLE Bookings (
    booking_id SERIAL PRIMARY KEY,
    room_number INT,
    building VARCHAR(50),
    FOREIGN KEY (room_number,building) REFERENCES Rooms,
    start_time  TIMESTAMP,
    end_time    TIMESTAMP,
    course_code VARCHAR(50),
    instructor VARCHAR(100),
    booking_type VARCHAR(20) -- e.g., LEC, MAINT
);

INSERT INTO Rooms (room_number, building, capacity, feautures) VALUES
(101, 'ALRD', 94, 'Tables, AC Power, Projector, Whiteboard, Document Camera'),
(102, 'ALRD', 60, 'Tables, AC Power, Projector, Whiteboard'),
(105, 'ALRD', 60, 'Tables, AC Power, Projector, Whiteboard'),
(201, 'LAW', 120, 'Theater seating, AC Power, Projector'),
(202, 'LAW', 80, 'Tables, AC Power, Whiteboard'),
(301, 'SOCI', 50, 'Tables, AC Power, Projector, Whiteboard');

INSERT INTO Bookings (room_number, building, start_time, end_time, course_code, instructor, booking_type) VALUES
(101, 'ALRD', '2025-10-11 09:00:00', '2025-10-11 10:30:00', 'LAW_V 559D', 'Aloni, Erez', 'LEC'),
(101, 'ALRD', '2025-10-11 13:30:00', '2025-10-11 15:00:00', 'LAW_V 459C', 'Hutchison, Camden', 'LEC'),
(102, 'ALRD', '2025-10-11 08:00:00', '2025-10-11 09:00:00', 'SOCI_V 384', 'Smith, Jane', 'LEC'),
(201, 'LAW', '2025-10-11 10:00:00', '2025-10-11 12:00:00', 'LAW_V 468', 'Goldbach, Toby', 'LEC'),
(301, 'SOCI', '2025-10-11 11:30:00', '2025-10-11 12:30:00', 'SOCI_V 387', 'Richardson, Lindsey', 'LEC');

-- Find Rooms that are free given a time range
-- SELECT R.room_number, R.building, R.capacity, R.feautures
-- FROM Rooms R
-- LEFT JOIN Bookings B
--     ON R.room_number = B.room_number
--     AND R.building = B.building
--     AND NOT (B.end_time <= '2025-10-11 09:00:00' OR B.start_time >= '2025-10-11 10:00:00')
-- WHERE B.booking_id IS NULL;

-- Find Rooms that are free in a building given a time range
-- SELECT R.room_number, R.building, R.capacity, R.feautures
-- FROM Rooms R
-- LEFT JOIN Bookings B
--     ON R.room_number = B.room_number
--     AND R.building = B.building
--     AND NOT (B.end_time <= '2025-10-11 09:00:00' OR B.start_time >= '2025-10-11 10:00:00')
-- WHERE B.booking_id IS NULL AND R.building = 'ALRD';

-- Query for Rooms that are free at that start time and earliest booking start after that time (if any) for each room
-- WITH FreeRooms AS (
--     SELECT R.room_number, R.building, R.capacity, R.feautures
--     FROM Rooms R
--     LEFT JOIN Bookings B
--         ON R.room_number = B.room_number
--         AND R.building = B.building
--         AND '2025-10-11 09:00:00' >= B.start_time
--         AND '2025-10-11 09:00:00' < B.end_time
--     WHERE B.booking_id IS NULL
-- )
-- SELECT
--     F.room_number,
--     F.building,
--     F.capacity,
--     F.feautures,
--     MIN(B.start_time) AS next_booking_start
-- FROM FreeRooms F
-- LEFT JOIN Bookings B
--     ON F.room_number = B.room_number
--     AND F.building = B.building
--     AND B.start_time > '2025-10-11 09:00:00'
-- GROUP BY F.room_number, F.building, F.capacity, F.feautures
-- ORDER BY F.room_number;

