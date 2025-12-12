-- DROPING TABLES
DROP TABLE IF EXISTS Bookings CASCADE;
DROP TABLE IF EXISTS Rooms CASCADE;

-- Table for Rooms
CREATE TABLE Rooms (
    room_number INT,
    building VARCHAR(50),
    capacity INT,
    features VARCHAR(1000),
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


-- Find Rooms that are free given a time range
SELECT R.room_number, R.building, R.capacity, R.feautures
FROM Rooms R
LEFT JOIN Bookings B
    ON R.room_number = B.room_number
    AND R.building = B.building
    AND NOT (B.end_time <= '2025-10-11 09:00:00' OR B.start_time >= '2025-10-11 10:00:00')
WHERE B.booking_id IS NULL;

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

-- Gets number of free rooms per building
SELECT
    R.building,
    COUNT(*) AS free_room_count
FROM Rooms R
LEFT JOIN Bookings B
    ON R.room_number = B.room_number
    AND R.building = B.building
    -- Detect overlapping bookings
    AND NOT (
        B.end_time   <= '2025-12-11 09:00:00' OR
        B.start_time >= '2025-12-11 10:00:00'
    )
WHERE B.booking_id IS NULL       -- Means: no conflicting booking
GROUP BY R.building
ORDER BY free_room_count DESC;   -- optional


-- Query RPCs

-- Function 1: Count free rooms per building
CREATE OR REPLACE FUNCTION free_rooms_per_building(
  p_start timestamp,
  p_end timestamp
)
RETURNS TABLE(building text, free_room_count bigint)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.building::text,
    COUNT(*)::bigint as free_room_count
  FROM Rooms r
  WHERE NOT EXISTS (
    SELECT 1
    FROM Bookings b
    WHERE b.room_number = r.room_number
      AND b.building = r.building
      AND b.start_time < p_end
      AND b.end_time > p_start
  )
  GROUP BY r.building
  ORDER BY r.building;
END;
$$;

-- Function 2: List all free rooms
CREATE OR REPLACE FUNCTION free_rooms_list(
  p_start timestamp,
  p_end timestamp
)
RETURNS TABLE(
  room_number integer,
  building text,
  capacity integer,
  features text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.room_number,
    r.building::text,
    r.capacity,
    r.features::text
  FROM Rooms r
  WHERE NOT EXISTS (
    SELECT 1
    FROM Bookings b
    WHERE b.room_number = r.room_number
      AND b.building = r.building
      AND b.start_time < p_end
      AND b.end_time > p_start
  )
  ORDER BY r.building, r.room_number;
END;
$$;

